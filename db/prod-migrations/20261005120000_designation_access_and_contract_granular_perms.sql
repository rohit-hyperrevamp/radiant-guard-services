-- Designation-based access (optionally within a department) + granular contract permissions.
-- Resolution: employee > designation in department > designation (any dept) > department > role.

ALTER TABLE public.access_overrides ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.access_overrides DROP CONSTRAINT IF EXISTS access_overrides_scope_type_check;
ALTER TABLE public.access_overrides ADD CONSTRAINT access_overrides_scope_type_check
  CHECK (scope_type IN ('department','employee','designation'));
ALTER TABLE public.access_overrides DROP CONSTRAINT IF EXISTS access_overrides_scope_type_scope_id_module_key_sub_module__key;
CREATE UNIQUE INDEX IF NOT EXISTS access_overrides_scope_uniq ON public.access_overrides
  (scope_type, scope_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), module_key, sub_module_key);

CREATE OR REPLACE FUNCTION public.current_user_effective_permissions()
RETURNS TABLE(module_key text, sub_module_key text, can_view boolean, can_edit boolean, can_delete boolean, can_approve boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT c.id, c.role_key, c.department_id, c.designation_id
    FROM auth.users u
    JOIN public.candidates c ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
    WHERE u.id = auth.uid()
    LIMIT 1
  ),
  lvl AS (
    SELECT o.*, CASE
      WHEN o.scope_type = 'employee' AND o.scope_id = me.id THEN 1
      WHEN o.scope_type = 'designation' AND o.scope_id = me.designation_id AND o.department_id = me.department_id THEN 2
      WHEN o.scope_type = 'designation' AND o.scope_id = me.designation_id AND o.department_id IS NULL THEN 3
      WHEN o.scope_type = 'department' AND o.scope_id = me.department_id THEN 4
    END AS lv
    FROM public.access_overrides o, me
  ),
  best AS (SELECT min(lv) AS lv FROM lvl WHERE lv IS NOT NULL)
  SELECT l.module_key, l.sub_module_key, l.can_view, l.can_edit, l.can_delete, l.can_approve
    FROM lvl l, best WHERE l.lv = best.lv
  UNION ALL
  SELECT rp.module_key, rp.sub_module_key, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
    FROM public.role_permissions rp JOIN me ON rp.role_key = me.role_key, best
   WHERE best.lv IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_effective_permissions() TO authenticated;

-- Contract mutations follow permissions, not hardcoded roles.
CREATE OR REPLACE FUNCTION public.prevent_hr_contract_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user()
     OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_TABLE_NAME = 'client_contracts' THEN
    IF TG_OP = 'INSERT' AND (public.current_user_has_permission('contracts','create','edit')
        OR public.current_user_has_permission('contracts','client_contracts','edit')) THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND public.current_user_has_permission('contracts','client_contracts','edit') THEN RETURN NEW; END IF;
    IF TG_OP = 'DELETE' AND public.current_user_has_permission('contracts','client_contracts','delete') THEN RETURN OLD; END IF;
  ELSE
    IF public.current_user_has_permission('contracts','resources','edit') THEN RETURN COALESCE(NEW, OLD); END IF;
    IF TG_OP = 'UPDATE' AND public.current_user_has_permission('contracts','edit_existing_rates','edit') THEN RETURN NEW; END IF;
    -- Copying a contract also copies its resources.
    IF TG_OP = 'INSERT' AND public.current_user_has_permission('contracts','create','edit') THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'You do not have permission to change this contract' USING ERRCODE = '42501';
END;
$$;

-- Preserve today's behaviour with the new sub-modules.
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT r, 'contracts', s, true, true, s = 'resources', false
FROM unnest(ARRAY['leadership']) r, unnest(ARRAY['create','resources']) s
ON CONFLICT (role_key, module_key, sub_module_key) DO UPDATE SET can_view = true, can_edit = true;
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
VALUES ('finance','contracts','create',true,true,false,false)
ON CONFLICT (role_key, module_key, sub_module_key) DO UPDATE SET can_view = true, can_edit = true;
-- Finance could never actually update contracts (blocked by trigger); make the flag honest.
UPDATE public.role_permissions SET can_edit = false
 WHERE role_key = 'finance' AND module_key = 'contracts' AND sub_module_key = 'client_contracts';

NOTIFY pgrst, 'reload schema';
