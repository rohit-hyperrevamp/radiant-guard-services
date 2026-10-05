-- Department / employee access overrides + contract rate permissions.
-- Resolution: employee rules (if any) > department rules (if any) > role rules.

CREATE TABLE IF NOT EXISTS public.access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('department','employee')),
  scope_id uuid NOT NULL,
  module_key text NOT NULL,
  sub_module_key text NOT NULL DEFAULT '',
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id, module_key, sub_module_key)
);
CREATE INDEX IF NOT EXISTS access_overrides_scope_idx ON public.access_overrides (scope_type, scope_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_overrides TO authenticated;
GRANT ALL ON public.access_overrides TO service_role;
ALTER TABLE public.access_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ao admin read" ON public.access_overrides;
CREATE POLICY "ao admin read" ON public.access_overrides FOR SELECT TO authenticated
  USING ((select public.is_admin_user()));
DROP POLICY IF EXISTS "ao admin insert" ON public.access_overrides;
CREATE POLICY "ao admin insert" ON public.access_overrides FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin_user()));
DROP POLICY IF EXISTS "ao admin update" ON public.access_overrides;
CREATE POLICY "ao admin update" ON public.access_overrides FOR UPDATE TO authenticated
  USING ((select public.is_admin_user())) WITH CHECK ((select public.is_admin_user()));
DROP POLICY IF EXISTS "ao admin delete" ON public.access_overrides;
CREATE POLICY "ao admin delete" ON public.access_overrides FOR DELETE TO authenticated
  USING ((select public.is_admin_user()));

DROP TRIGGER IF EXISTS access_overrides_set_updated_at ON public.access_overrides;
CREATE TRIGGER access_overrides_set_updated_at BEFORE UPDATE ON public.access_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_effective_permissions()
RETURNS TABLE(module_key text, sub_module_key text, can_view boolean, can_edit boolean, can_delete boolean, can_approve boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT c.id, c.role_key, c.department_id
    FROM auth.users u
    JOIN public.candidates c ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
    WHERE u.id = auth.uid()
    LIMIT 1
  ),
  emp AS (
    SELECT o.* FROM public.access_overrides o JOIN me ON o.scope_type = 'employee' AND o.scope_id = me.id
  ),
  dep AS (
    SELECT o.* FROM public.access_overrides o JOIN me ON o.scope_type = 'department' AND o.scope_id = me.department_id
  )
  SELECT module_key, sub_module_key, can_view, can_edit, can_delete, can_approve FROM emp
  UNION ALL
  SELECT module_key, sub_module_key, can_view, can_edit, can_delete, can_approve FROM dep
   WHERE NOT EXISTS (SELECT 1 FROM emp)
  UNION ALL
  SELECT rp.module_key, rp.sub_module_key, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
    FROM public.role_permissions rp JOIN me ON rp.role_key = me.role_key
   WHERE NOT EXISTS (SELECT 1 FROM emp) AND NOT EXISTS (SELECT 1 FROM dep);
$$;
GRANT EXECUTE ON FUNCTION public.current_user_effective_permissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(_module_key text, _sub_module_key text DEFAULT ''::text, _action text DEFAULT 'view'::text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(public.current_user_role_key(), '') IN ('admin','super_admin') THEN true
    ELSE COALESCE((
      SELECT CASE _action
        WHEN 'view' THEN p.can_view WHEN 'edit' THEN p.can_edit
        WHEN 'delete' THEN p.can_delete WHEN 'approve' THEN p.can_approve ELSE false END
      FROM public.current_user_effective_permissions() p
      WHERE p.module_key = _module_key AND COALESCE(p.sub_module_key,'') = COALESCE(_sub_module_key,'')
      LIMIT 1), false)
  END;
$$;

-- Who may create/approve revised rates (Copy as revised rate).
CREATE OR REPLACE FUNCTION public.current_user_can_edit_contract_rates()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin')
      OR public.current_user_has_permission('contracts','rate_revision','edit');
$$;

-- Who may directly edit an existing (present) contract rate.
CREATE OR REPLACE FUNCTION public.current_user_can_edit_existing_contract_rates()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin')
      OR public.current_user_has_permission('contracts','edit_existing_rates','edit');
$$;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_existing_contract_rates() TO authenticated;

-- Keep Leadership's existing ability to revise rates.
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit)
VALUES ('leadership','contracts','rate_revision',true,true)
ON CONFLICT (role_key, module_key, sub_module_key) DO UPDATE SET can_view = true, can_edit = true;

NOTIFY pgrst, 'reload schema';
