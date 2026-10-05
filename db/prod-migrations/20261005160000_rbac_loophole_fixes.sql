-- Loophole fixes found by the RBAC test run.

-- Any grant in a module (module row or any sub-module) for an action.
CREATE OR REPLACE FUNCTION public.current_user_module_access(_module_key text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_user_role_key(), '') IN ('admin','super_admin') OR EXISTS (
    SELECT 1 FROM public.current_user_effective_permissions() p
    WHERE p.module_key = _module_key AND CASE _action
      WHEN 'view' THEN p.can_view OR p.can_edit OR p.can_delete OR p.can_approve
      WHEN 'edit' THEN p.can_edit OR p.can_delete
      WHEN 'delete' THEN p.can_delete WHEN 'approve' THEN p.can_approve ELSE false END);
$$;
GRANT EXECUTE ON FUNCTION public.current_user_module_access(text,text) TO authenticated;

-- A missing action row is a "no" when the rule set lists other actions for that
-- module (stops an unrelated grant from unlocking it); otherwise use the module row.
CREATE OR REPLACE FUNCTION public.current_user_action_allowed(_module_key text, _sub_module_key text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    public.current_user_explicit_permission(_module_key, _sub_module_key, _action),
    CASE WHEN EXISTS (SELECT 1 FROM public.current_user_effective_permissions() p
                      WHERE p.module_key = _module_key AND COALESCE(p.sub_module_key,'') <> '')
         THEN false END,
    public.current_user_explicit_permission(_module_key, '', _action));
$$;

-- Inventory access came from a fixed role list; now Access Control grants count too.
CREATE OR REPLACE FUNCTION public.current_user_is_inventory_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role_key() IN ('inventory_manager', 'inventory')
      OR public.current_user_module_access('inventory', 'edit');
$$;

-- Organizations edit read the role matrix directly and ignored department/designation rules.
CREATE OR REPLACE FUNCTION public.current_user_can_edit_organizations()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user() OR (public.is_current_employee_active()
     AND public.current_user_module_access('organizations', 'edit'));
$$;

-- Recruitment / CRM: honour sub-module-only grants; drop the hardcoded phone backdoor.
CREATE OR REPLACE FUNCTION public.current_user_can_recruit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_is_super_admin() OR public.current_user_module_access('recruitment', 'view');
$$;
CREATE OR REPLACE FUNCTION public.current_user_can_crm()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_user_role_key(), '') = 'super_admin'
      OR public.current_user_module_access('sales_marketing', 'view');
$$;

NOTIFY pgrst, 'reload schema';
