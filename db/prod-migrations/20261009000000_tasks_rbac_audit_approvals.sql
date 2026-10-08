-- Tasks access control, full audit trail, data-driven approval requests
-- (sensitive employee field changes go through workflow approval).

-- ===== 1. Tasks RBAC (module "tasks"; no row = previous behaviour) =====
CREATE OR REPLACE FUNCTION public.current_user_is_task_overseer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin')
    OR COALESCE(public.current_user_explicit_permission('tasks','view_all','view'), EXISTS (
    SELECT 1 FROM public.candidates c LEFT JOIN public.departments d ON d.id = c.department_id
    WHERE c.mobile = public.current_user_mobile()
      AND (c.role_key IN ('leadership','super_admin','admin') OR d.name = 'Leadership')));
$$;
CREATE OR REPLACE FUNCTION public.current_user_can_assign_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin')
    OR COALESCE(public.current_user_explicit_permission('tasks','create','edit'),
      public.current_user_is_task_overseer() OR EXISTS (
      SELECT 1 FROM public.candidates c LEFT JOIN public.departments d ON d.id = c.department_id
      WHERE c.mobile = public.current_user_mobile()
        AND (d.name = 'Legal'
          OR EXISTS (SELECT 1 FROM public.candidates r WHERE r.reports_to = c.id AND r.status IN ('active','approved'))
          OR EXISTS (SELECT 1 FROM public.candidate_reporting_managers m WHERE m.manager_id = c.id))));
$$;
-- Manage (change dates / cancel / reopen) tasks created by others.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin')
    OR COALESCE(public.current_user_explicit_permission('tasks','manage','edit'), public.current_user_is_task_overseer());
$$;
CREATE OR REPLACE FUNCTION public.current_user_can_delete_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin')
    OR COALESCE(public.current_user_explicit_permission('tasks','delete','delete'), true);
$$;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_tasks(), public.current_user_can_delete_tasks() TO authenticated;

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (
  created_by = (SELECT public.current_user_candidate_id()) OR (SELECT public.current_user_can_manage_tasks()));
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (
  (SELECT public.current_user_can_delete_tasks())
  AND (created_by = (SELECT public.current_user_candidate_id()) OR (SELECT public.current_user_is_task_overseer())));
CREATE OR REPLACE FUNCTION public.task_action(_task_id uuid, _action text, _note text DEFAULT NULL::text, _until timestamp with time zone DEFAULT NULL::timestamp with time zone, _paths text[] DEFAULT NULL::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks; me uuid := public.current_user_candidate_id();
  is_assignee boolean; is_manager boolean;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  is_assignee := t.assignee_id = me;
  is_manager := (t.created_by = me AND COALESCE(public.current_user_explicit_permission('tasks','manage','edit'), true)) OR public.current_user_can_manage_tasks();
  IF NOT (is_assignee OR is_manager) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF _action = 'acknowledge' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can acknowledge'; END IF;
    UPDATE public.tasks SET status = CASE WHEN status='open' THEN 'acknowledged' ELSE status END,
      acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now() WHERE id = t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:acknowledged', 'Task acknowledged: ' || t.title, _note);
  ELSIF _action = 'request_extension' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can ask for more time'; END IF;
    IF _until IS NULL OR coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'New date and reason are required'; END IF;
    UPDATE public.tasks SET status='extension_requested', extension_until=_until, extension_reason=_note,
      acknowledged_at = coalesce(acknowledged_at, now()), updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:extension_requested', 'More time requested: ' || t.title,
      'Until ' || to_char(_until AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM') || ' — ' || _note);
  ELSIF _action IN ('approve_extension','reject_extension') THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Only the task creator or leadership can decide'; END IF;
    IF _action = 'approve_extension' THEN
      UPDATE public.tasks SET due_at = coalesce(_until, extension_until, due_at), status='acknowledged',
        extension_until=NULL, updated_at=now() WHERE id=t.id;
      PERFORM public.task_notify(t.assignee_id, t, 'task:extension_approved', 'New due date: ' || t.title,
        to_char(coalesce(_until, t.extension_until) AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM'));
    ELSE
      UPDATE public.tasks SET status='acknowledged', extension_until=NULL, updated_at=now() WHERE id=t.id;
      PERFORM public.task_notify(t.assignee_id, t, 'task:extension_rejected', 'More time not approved: ' || t.title, _note);
    END IF;
  ELSIF _action = 'complete' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can complete'; END IF;
    IF coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'Please write a note'; END IF;
    UPDATE public.tasks SET status='completed', completion_note=_note, completed_at=now(),
      proof_paths = proof_paths || coalesce(_paths,'{}'), acknowledged_at = coalesce(acknowledged_at, now()),
      updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:completed', 'Task completed: ' || t.title, _note);
  ELSIF _action = 'reopen' THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.tasks SET status='open', completed_at=NULL, due_at=coalesce(_until, due_at), updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id, t, 'task:reopen', 'Task reopened: ' || t.title, _note);
  ELSIF _action = 'cancel' THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.tasks SET status='cancelled', updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id, t, 'task:cancel', 'Task cancelled: ' || t.title, _note);
  ELSIF _action = 'comment' THEN
    NULL;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;

  INSERT INTO public.task_events(task_id, actor_id, kind, note, data)
  VALUES (t.id, me, _action, _note, jsonb_strip_nulls(jsonb_build_object('until', _until, 'paths', _paths)));
END $function$

;

-- ===== 2. Audit trail =====
ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS actor_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_designation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_department text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_employee_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';

CREATE OR REPLACE FUNCTION public.system_logs_fill_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record;
BEGIN
  IF NEW.user_id IS NULL THEN NEW.user_id := auth.uid(); END IF;
  BEGIN
    SELECT ca.full_name, ca.employee_code, ca.mobile, ca.role_key, dg.name AS dg, dp.name AS dp INTO c
    FROM public.candidates ca
    LEFT JOIN public.designations dg ON dg.id = ca.designation_id
    LEFT JOIN public.departments dp ON dp.id = ca.department_id
    WHERE ca.id = public.get_candidate_id_by_user_id(NEW.user_id) LIMIT 1;
    IF FOUND THEN
      NEW.actor_name := COALESCE(NULLIF(NEW.actor_name,''), c.full_name, '');
      NEW.actor_designation := COALESCE(NULLIF(NEW.actor_designation,''), c.dg, '');
      NEW.actor_department := COALESCE(NULLIF(NEW.actor_department,''), c.dp, '');
      NEW.actor_employee_code := COALESCE(NULLIF(NEW.actor_employee_code,''), c.employee_code, '');
      NEW.user_phone := COALESCE(NULLIF(NEW.user_phone,''), c.mobile, '');
      NEW.user_role := COALESCE(NULLIF(NEW.user_role,''), c.role_key, '');
    ELSIF NEW.user_id IS NULL AND NEW.actor_name = '' THEN
      NEW.actor_name := 'System (automatic)';
    END IF;
  EXCEPTION WHEN others THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS system_logs_fill_actor ON public.system_logs;
CREATE TRIGGER system_logs_fill_actor BEFORE INSERT ON public.system_logs
  FOR EACH ROW EXECUTE FUNCTION public.system_logs_fill_actor();

CREATE OR REPLACE FUNCTION public.audit_mask(_k text, _v jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _k ~ '(aadhaar_number|pan_number|bank_account_number)$' AND jsonb_typeof(_v) = 'string'
              AND length(_v #>> '{}') > 4
         THEN to_jsonb(repeat('•', length(_v #>> '{}') - 4) || right(_v #>> '{}', 4)) ELSE _v END;
$$;

-- Generic row audit. TG_ARGV[0] = module label shown in System Logs.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o jsonb; n jsonb; ch jsonb := '{}'::jsonb; k text; r jsonb; lbl text;
BEGIN
  BEGIN
    o := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    n := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    FOR k IN SELECT jsonb_object_keys(COALESCE(n, o)) LOOP
      CONTINUE WHEN k IN ('updated_at','created_at','search_text','formula_version');
      IF (o -> k) IS DISTINCT FROM (n -> k) AND NOT (TG_OP = 'INSERT' AND (n -> k) IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb, '{}'::jsonb)) THEN
        ch := ch || jsonb_build_object(k, jsonb_build_object('from', public.audit_mask(k, COALESCE(o -> k, 'null')), 'to', public.audit_mask(k, COALESCE(n -> k, 'null'))));
      END IF;
    END LOOP;
    IF TG_OP = 'UPDATE' AND ch = '{}'::jsonb THEN RETURN NULL; END IF;
    r := COALESCE(n, o);
    lbl := COALESCE(r->>'full_name', r->>'title', r->>'name', r->>'contract_code', r->>'unit_code', r->>'key',
      CASE WHEN r ? 'module_key' THEN concat_ws(' · ', r->>'role_key', r->>'scope_type', r->>'module_key', NULLIF(r->>'sub_module_key','')) END, '');
    INSERT INTO public.system_logs(module, action, entity_type, entity_id, entity_label, user_id, status, error_message, details, source,
      user_phone, user_role, ip_address, user_agent)
    VALUES (TG_ARGV[0], CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END,
      TG_TABLE_NAME, COALESCE(r->>'id',''), lbl, auth.uid(), 'success', '',
      jsonb_build_object('source','database','changes', ch), 'database', '', '', '', '');
  EXCEPTION WHEN others THEN NULL; END;
  RETURN NULL;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('role_permissions','Access Control'), ('access_overrides','Access Control'), ('roles','Roles Manager'),
    ('workflow_definitions','Workflow Manager'), ('workflow_steps','Workflow Manager'),
    ('departments','Department Manager'), ('designations','Designation Manager'),
    ('org_settings','Company Settings'), ('platform_settings','Platform Settings'),
    ('candidates','Employees'), ('candidate_units','Employee Mapping'), ('candidate_designations','Employee Mapping'),
    ('candidate_reporting_managers','Employee Mapping'), ('employee_scope_assignments','Employee Mapping'),
    ('employee_wages','Employee Wages'), ('client_contracts','Client Contracts'), ('contract_resources','Contract Resources'),
    ('contract_rate_revisions','Rate Revisions'), ('units','Clients'), ('customers','Organizations'),
    ('branches','Branch Manager'), ('states','State Manager'), ('attendance_sheets','Attendance'),
    ('payroll_runs','Payroll'), ('additions','Additions'), ('deductions','Deductions'),
    ('allowance_types','Allowance Manager'), ('cost_components','Cost Component Manager'),
    ('inv_items','Uniform Products'), ('inv_purchase_orders','Uniform Purchase Orders'), ('inv_adjustments','Uniform Stock Adjustments'),
    ('vehicles','Vehicle Inventory'), ('properties','Asset Inventory'), ('rehire_requests','Rehire'),
    ('tasks','Tasks'), ('contract_expiry_alert_settings','Contract Expiry Alerts'), ('approval_requests','Approvals')
  ) t(tbl, label) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS zz_audit ON public.%I', r.tbl);
      EXECUTE format('CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(%L)', r.tbl, r.label);
    END IF;
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON public.system_logs (created_at DESC);

-- ===== 3. Approval chains: richer approvers =====
ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS approver_candidate_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approver_department_id uuid;

-- Named people / department, when set, are the only approvers; otherwise the role.
CREATE OR REPLACE FUNCTION public.workflow_step_matches(_step_id uuid, _candidate uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workflow_steps s JOIN public.candidates c ON c.id = _candidate
    WHERE s.id = _step_id AND s.is_active AND c.status IN ('active','approved') AND
      CASE WHEN s.approver_candidate_id IS NOT NULL OR cardinality(s.approver_candidate_ids) > 0 OR s.approver_department_id IS NOT NULL
        THEN c.id = s.approver_candidate_id OR c.id = ANY (s.approver_candidate_ids) OR c.department_id = s.approver_department_id
        ELSE COALESCE(s.approver_role_key,'') <> '' AND c.role_key = s.approver_role_key END);
$$;
CREATE OR REPLACE FUNCTION public.current_user_in_workflow(_workflow_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.workflow_steps s JOIN public.workflow_definitions d ON d.id = s.workflow_id
    WHERE d.key = _workflow_key AND d.is_active AND public.workflow_step_matches(s.id, public.current_user_candidate_id()));
$$;
GRANT EXECUTE ON FUNCTION public.workflow_step_matches(uuid,uuid), public.current_user_in_workflow(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_approve_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(), '') IN ('super_admin', 'admin')
    OR COALESCE(public.current_user_explicit_permission('payroll','approve','approve'), false)
    OR public.current_user_in_workflow('payroll_approval');
$$;
CREATE OR REPLACE FUNCTION public.current_user_can_process_payroll()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(), '') IN ('super_admin', 'admin')
    OR COALESCE(public.current_user_explicit_permission('payroll','process','edit'), false)
    OR public.current_user_in_workflow('payroll_processing');
$$;
CREATE OR REPLACE FUNCTION public.current_user_can_onboard_recruit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.current_user_is_super_admin() OR public.current_user_in_workflow('recruitment_onboarding');
$$;
CREATE OR REPLACE FUNCTION public.get_recruitment_onboarder_user_ids()
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT u.id FROM public.workflow_steps s
  JOIN public.workflow_definitions d ON d.id = s.workflow_id
  JOIN public.candidates c ON public.workflow_step_matches(s.id, c.id)
  JOIN auth.users u ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
  WHERE d.key = 'recruitment_onboarding' AND d.is_active AND s.is_active;
$$;

-- ===== 4. Approval requests =====
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  title text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  current_step int NOT NULL DEFAULT 1,
  decided_by uuid,
  decision_note text NOT NULL DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.approval_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  step_order int,
  action text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approval_requests_status_idx ON public.approval_requests (status, workflow_key);
CREATE INDEX IF NOT EXISTS approval_requests_entity_idx ON public.approval_requests (entity_id);
GRANT SELECT ON public.approval_requests, public.approval_request_events TO authenticated;
GRANT ALL ON public.approval_requests, public.approval_request_events TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_sees_all_approvals()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin','leadership')
    OR COALESCE(public.current_user_explicit_permission('approvals','view_all','view'), false);
$$;
GRANT EXECUTE ON FUNCTION public.current_user_sees_all_approvals() TO authenticated;

DROP POLICY IF EXISTS approval_requests_select ON public.approval_requests;
CREATE POLICY approval_requests_select ON public.approval_requests FOR SELECT TO authenticated USING (
  requested_by = (SELECT public.current_user_candidate_id())
  OR (SELECT public.current_user_sees_all_approvals())
  OR public.current_user_in_workflow(workflow_key));
DROP POLICY IF EXISTS approval_request_events_select ON public.approval_request_events;
CREATE POLICY approval_request_events_select ON public.approval_request_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id));

CREATE OR REPLACE FUNCTION public.approval_notify(_candidate uuid, _req public.approval_requests, _title text, _msg text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := public.get_user_id_by_candidate(_candidate);
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(id, user_id, actor_id, type, title, message, link, entity_type, entity_id)
  VALUES (gen_random_uuid(), _uid, auth.uid(), 'approval:' || _req.workflow_key, _title, coalesce(_msg,''),
          '/admin/approvals?request=' || _req.id, 'approval_request', _req.id::text);
END $$;

CREATE OR REPLACE FUNCTION public.approval_notify_step(_req public.approval_requests)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; c record; who text;
BEGIN
  SELECT full_name INTO who FROM public.candidates WHERE id = _req.requested_by;
  SELECT st.* INTO s FROM public.workflow_steps st JOIN public.workflow_definitions d ON d.id = st.workflow_id
   WHERE d.key = _req.workflow_key AND st.step_order = _req.current_step AND st.is_active LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  FOR c IN SELECT ca.id FROM public.candidates ca WHERE public.workflow_step_matches(s.id, ca.id) LOOP
    PERFORM public.approval_notify(c.id, _req, 'Approval needed: ' || _req.title,
      coalesce(who,'Someone') || ' sent a request for your approval (' || s.name || ').');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.approval_first_step(_workflow_key text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT min(s.step_order) FROM public.workflow_steps s JOIN public.workflow_definitions d ON d.id = s.workflow_id
  WHERE d.key = _workflow_key AND d.is_active AND s.is_active;
$$;

CREATE OR REPLACE FUNCTION public.approval_create(_workflow_key text, _entity_type text, _entity_id uuid,
  _title text, _payload jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _step int := public.approval_first_step(_workflow_key); _req public.approval_requests;
BEGIN
  IF _step IS NULL THEN RAISE EXCEPTION 'This approval process is switched off or has no approval steps'; END IF;
  INSERT INTO public.approval_requests(workflow_key, entity_type, entity_id, title, payload, reason, requested_by, current_step)
  VALUES (_workflow_key, _entity_type, _entity_id, _title, _payload, coalesce(_reason,''), public.current_user_candidate_id(), _step)
  RETURNING * INTO _req;
  INSERT INTO public.approval_request_events(request_id, actor_id, step_order, action, note)
  VALUES (_req.id, _req.requested_by, _step, 'submitted', coalesce(_reason,''));
  PERFORM public.approval_notify_step(_req);
  RETURN _req.id;
END $$;

-- Sensitive employee fields that need approval once an employee is active.
CREATE OR REPLACE FUNCTION public.sensitive_employee_fields()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['full_name','date_of_birth','aadhaar_number','pan_number','bank_account_holder','bank_account_number',
               'bank_ifsc','bank_name','bank_branch','bank_account_type','aadhaar_image_url','aadhaar_back_image_url','pan_image_url'];
$$;

CREATE OR REPLACE FUNCTION public.request_employee_change(_candidate uuid, _changes jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur jsonb; k text; p jsonb := '{}'::jsonb; nm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT (public.is_admin_user() OR COALESCE(public.current_user_explicit_permission('employees','edit','edit'),
          public.current_user_explicit_permission('employees','','edit'), false)
          OR public.current_user_role_key() IN ('super_admin','admin','hr','hr_executive','leadership')) THEN
    RAISE EXCEPTION 'You need Edit access to employees to request a change' USING ERRCODE='42501';
  END IF;
  SELECT to_jsonb(c), c.full_name INTO cur, nm FROM public.candidates c WHERE c.id = _candidate;
  IF cur IS NULL THEN RAISE EXCEPTION 'Employee not found'; END IF;
  FOR k IN SELECT jsonb_object_keys(_changes) LOOP
    IF NOT k = ANY (public.sensitive_employee_fields()) THEN RAISE EXCEPTION 'Field % cannot be requested here', k; END IF;
    IF (cur -> k) IS DISTINCT FROM (_changes -> k) THEN
      p := p || jsonb_build_object(k, jsonb_build_object('from', cur -> k, 'to', _changes -> k));
    END IF;
  END LOOP;
  IF p = '{}'::jsonb THEN RAISE EXCEPTION 'Nothing changed'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  RETURN public.approval_create('employee_sensitive_change', 'candidate', _candidate,
    'Change details of ' || coalesce(nm,'employee'), jsonb_build_object('changes', p), _reason);
END $$;
GRANT EXECUTE ON FUNCTION public.request_employee_change(uuid,jsonb,text) TO authenticated;

-- Block direct edits of sensitive fields; turn them into a request instead.
CREATE OR REPLACE FUNCTION public.guard_sensitive_employee_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o jsonb := to_jsonb(OLD); n jsonb := to_jsonb(NEW); k text; p jsonb := '{}'::jsonb; rev jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR current_setting('app.approved_change', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD.status NOT IN ('active','approved') THEN RETURN NEW; END IF;
  IF public.approval_first_step('employee_sensitive_change') IS NULL THEN RETURN NEW; END IF;
  IF public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin')
     OR public.current_user_in_workflow('employee_sensitive_change') THEN RETURN NEW; END IF;
  -- Own profile: the employee may not change these either.
  FOREACH k IN ARRAY public.sensitive_employee_fields() LOOP
    IF (o -> k) IS DISTINCT FROM (n -> k) AND coalesce(o ->> k, '') <> '' THEN
      p := p || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      rev := rev || jsonb_build_object(k, o -> k);
    END IF;
  END LOOP;
  IF p = '{}'::jsonb THEN RETURN NEW; END IF;
  NEW := jsonb_populate_record(NEW, rev);
  IF NOT EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.entity_id = OLD.id AND r.status = 'pending'
                 AND r.workflow_key = 'employee_sensitive_change' AND r.payload -> 'changes' = p) THEN
    PERFORM public.approval_create('employee_sensitive_change', 'candidate', OLD.id,
      'Change details of ' || coalesce(OLD.full_name,'employee'), jsonb_build_object('changes', p),
      'Edited from the employee form');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_sensitive_employee_fields ON public.candidates;
CREATE TRIGGER guard_sensitive_employee_fields BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_sensitive_employee_fields();

CREATE OR REPLACE FUNCTION public.approval_apply(_req public.approval_requests)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text; sets text[] := '{}'; newv jsonb := '{}'::jsonb;
BEGIN
  IF _req.workflow_key = 'employee_sensitive_change' THEN
    FOR k IN SELECT jsonb_object_keys(_req.payload -> 'changes') LOOP
      IF k = ANY (public.sensitive_employee_fields()) THEN
        newv := newv || jsonb_build_object(k, _req.payload -> 'changes' -> k -> 'to');
        sets := sets || format('%I = (jsonb_populate_record(NULL::public.candidates, $1)).%I', k, k);
      END IF;
    END LOOP;
    IF cardinality(sets) > 0 THEN
      PERFORM set_config('app.approved_change', 'on', true);
      EXECUTE 'UPDATE public.candidates SET ' || array_to_string(sets, ', ') || ' WHERE id = $2' USING newv, _req.entity_id;
      PERFORM set_config('app.approved_change', 'off', true);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.approval_decide(_id uuid, _decision text, _note text DEFAULT '')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.approval_requests; me uuid := public.current_user_candidate_id(); s record; nxt int; sa boolean;
BEGIN
  SELECT * INTO r FROM public.approval_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request is already %', r.status; END IF;
  sa := public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin');
  IF _decision = 'cancel' THEN
    IF r.requested_by IS DISTINCT FROM me AND NOT sa THEN RAISE EXCEPTION 'Only the requester can withdraw this'; END IF;
    UPDATE public.approval_requests SET status='cancelled', decided_by=me, decision_note=coalesce(_note,''), decided_at=now(), updated_at=now() WHERE id=_id;
    INSERT INTO public.approval_request_events(request_id, actor_id, step_order, action, note) VALUES (_id, me, r.current_step, 'cancelled', coalesce(_note,''));
    RETURN 'cancelled';
  END IF;
  SELECT st.* INTO s FROM public.workflow_steps st JOIN public.workflow_definitions d ON d.id = st.workflow_id
   WHERE d.key = r.workflow_key AND st.step_order = r.current_step LIMIT 1;
  IF NOT (sa OR (s.id IS NOT NULL AND public.workflow_step_matches(s.id, me))) THEN
    RAISE EXCEPTION 'You are not an approver for this step' USING ERRCODE='42501';
  END IF;
  IF r.requested_by = me AND NOT sa THEN RAISE EXCEPTION 'You cannot approve your own request'; END IF;
  IF _decision = 'reject' THEN
    UPDATE public.approval_requests SET status='rejected', decided_by=me, decision_note=coalesce(_note,''), decided_at=now(), updated_at=now() WHERE id=_id RETURNING * INTO r;
    INSERT INTO public.approval_request_events(request_id, actor_id, step_order, action, note) VALUES (_id, me, r.current_step, 'rejected', coalesce(_note,''));
    PERFORM public.approval_notify(r.requested_by, r, 'Request rejected: ' || r.title, coalesce(NULLIF(_note,''), 'No message'));
    RETURN 'rejected';
  ELSIF _decision <> 'approve' THEN RAISE EXCEPTION 'Unknown decision';
  END IF;
  INSERT INTO public.approval_request_events(request_id, actor_id, step_order, action, note) VALUES (_id, me, r.current_step, 'approved', coalesce(_note,''));
  SELECT min(st.step_order) INTO nxt FROM public.workflow_steps st JOIN public.workflow_definitions d ON d.id = st.workflow_id
   WHERE d.key = r.workflow_key AND st.is_active AND st.step_order > r.current_step;
  IF nxt IS NOT NULL THEN
    UPDATE public.approval_requests SET current_step = nxt, updated_at = now() WHERE id=_id RETURNING * INTO r;
    PERFORM public.approval_notify_step(r);
    PERFORM public.approval_notify(r.requested_by, r, 'Request moved to next approval: ' || r.title, coalesce(NULLIF(_note,''), ''));
    RETURN 'next_step';
  END IF;
  UPDATE public.approval_requests SET status='approved', decided_by=me, decision_note=coalesce(_note,''), decided_at=now(), updated_at=now() WHERE id=_id RETURNING * INTO r;
  PERFORM public.approval_apply(r);
  PERFORM public.approval_notify(r.requested_by, r, 'Request approved: ' || r.title, coalesce(NULLIF(_note,''), 'Approved'));
  RETURN 'approved';
END $$;
GRANT EXECUTE ON FUNCTION public.approval_decide(uuid,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approval_create(text,text,uuid,text,jsonb,text), public.approval_apply(public.approval_requests) FROM PUBLIC, anon, authenticated;

-- Seed the sensitive-change workflow: Leadership approves.
INSERT INTO public.workflow_definitions(key, name, description, entity_type, route_path, is_active)
SELECT 'employee_sensitive_change', 'Employee legal details change',
  'Changes to name, date of birth, Aadhaar, PAN or bank details of an active employee need approval.', 'candidates', '/admin/approvals', true
WHERE NOT EXISTS (SELECT 1 FROM public.workflow_definitions WHERE key = 'employee_sensitive_change');
INSERT INTO public.workflow_steps(workflow_id, step_order, key, name, description, approver_role_key, action_label, is_active)
SELECT d.id, 1, 'leadership_review', 'Leadership review', 'Leadership approves or rejects the change.', 'leadership', 'Approve', true
FROM public.workflow_definitions d WHERE d.key = 'employee_sensitive_change'
  AND NOT EXISTS (SELECT 1 FROM public.workflow_steps s WHERE s.workflow_id = d.id);

NOTIFY pgrst, 'reload schema';
