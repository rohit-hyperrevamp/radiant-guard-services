-- Action-level RBAC for Attendance, Payroll and Invoice.
-- An explicit action row (e.g. attendance::reopen) is the authority; without
-- one, the module-level grant (or the payroll workflow) still applies.

CREATE OR REPLACE FUNCTION public.current_user_explicit_permission(_module_key text, _sub_module_key text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _action
    WHEN 'view' THEN p.can_view WHEN 'edit' THEN p.can_edit
    WHEN 'delete' THEN p.can_delete WHEN 'approve' THEN p.can_approve END
  FROM public.current_user_effective_permissions() p
  WHERE p.module_key = _module_key AND COALESCE(p.sub_module_key,'') = _sub_module_key
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_explicit_permission(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_approve_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
    OR COALESCE(public.current_user_role_key(), '') IN ('super_admin', 'admin')
    OR COALESCE(public.current_user_explicit_permission('payroll','approve','approve'), false)
    OR EXISTS (
      SELECT 1 FROM public.workflow_steps s
      JOIN public.workflow_definitions d ON d.id = s.workflow_id
      WHERE d.key = 'payroll_approval' AND d.is_active AND s.is_active
        AND CASE WHEN s.approver_candidate_id IS NOT NULL
                 THEN s.approver_candidate_id = public.current_user_candidate_id()
                 ELSE s.approver_role_key = public.current_user_role_key() END
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_process_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
    OR COALESCE(public.current_user_role_key(), '') IN ('super_admin', 'admin')
    OR COALESCE(public.current_user_explicit_permission('payroll','process','edit'), false)
    OR EXISTS (
      SELECT 1 FROM public.workflow_steps s
      JOIN public.workflow_definitions d ON d.id = s.workflow_id
      WHERE d.key = 'payroll_processing' AND d.is_active AND s.is_active
        AND CASE WHEN s.approver_candidate_id IS NOT NULL
                 THEN s.approver_candidate_id = public.current_user_candidate_id()
                 ELSE s.approver_role_key = public.current_user_role_key() END
    );
$$;

-- Attendance sheet transitions follow action permissions.
CREATE OR REPLACE FUNCTION public.guard_attendance_sheet_actions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sub text; _act text;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user()
     OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM COALESCE(OLD.status, 'draft') THEN
    IF NEW.status = 'submitted' THEN _sub := 'submit'; _act := 'edit';
    ELSIF NEW.status IN ('approved','rejected') THEN _sub := 'approve'; _act := 'approve';
    ELSIF NEW.status = 'draft' AND OLD.status = 'approved' THEN _sub := 'reopen'; _act := 'approve';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.amendment_status IS DISTINCT FROM OLD.amendment_status THEN
    IF NEW.amendment_status = 'open' THEN _sub := 'amend'; _act := 'approve';
    ELSIF NEW.amendment_status = 'submitted' THEN _sub := 'submit'; _act := 'edit';
    ELSIF NEW.amendment_status = 'approved' THEN _sub := 'approve'; _act := 'approve';
    END IF;
  END IF;
  IF _sub IS NOT NULL AND public.current_user_explicit_permission('attendance', _sub, _act) IS FALSE THEN
    RAISE EXCEPTION 'You do not have permission to % this attendance', _sub USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_attendance_sheet_actions ON public.attendance_sheets;
CREATE TRIGGER guard_attendance_sheet_actions BEFORE INSERT OR UPDATE OF status, amendment_status
  ON public.attendance_sheets FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_sheet_actions();

-- Seed action rows from each role's current module grant so nothing changes today.
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT rp.role_key, 'attendance', a.k, rp.can_view,
       CASE WHEN a.t = 'edit' THEN rp.can_edit ELSE false END, false,
       CASE WHEN a.t = 'approve' THEN rp.can_approve ELSE false END
FROM public.role_permissions rp
CROSS JOIN (VALUES ('mark','edit'),('upload','edit'),('submit','edit'),('approve','approve'),('reopen','approve'),('amend','approve')) a(k,t)
WHERE rp.module_key = 'attendance' AND COALESCE(rp.sub_module_key,'') = ''
ON CONFLICT (role_key, module_key, sub_module_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT rp.role_key, 'payroll', a.k, rp.can_view,
       CASE WHEN a.t = 'edit' THEN rp.can_edit ELSE false END, false,
       CASE WHEN a.t = 'approve' THEN rp.can_approve ELSE false END
FROM public.role_permissions rp
CROSS JOIN (VALUES ('submit','edit'),('reopen','approve')) a(k,t)
WHERE rp.module_key = 'payroll' AND COALESCE(rp.sub_module_key,'') = ''
ON CONFLICT (role_key, module_key, sub_module_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT rp.role_key, 'invoice', a.k, rp.can_view, rp.can_edit, false, false
FROM public.role_permissions rp
CROSS JOIN (VALUES ('finalise'),('upload_tally')) a(k)
WHERE rp.module_key = 'invoice' AND COALESCE(rp.sub_module_key,'') = ''
ON CONFLICT (role_key, module_key, sub_module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
