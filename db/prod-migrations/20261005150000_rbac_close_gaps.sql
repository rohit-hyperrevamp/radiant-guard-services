-- Close RBAC gaps: per-module override resolution, action fallback to module
-- row, create/delete guards on workflow tables, and protected employee fields.

-- 1) Overrides win per module. Before, one designation rule for any module
--    replaced the whole role matrix (people silently lost unrelated access).
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
  best AS (SELECT l.module_key, min(l.lv) AS lv FROM lvl l WHERE l.lv IS NOT NULL GROUP BY l.module_key)
  SELECT l.module_key, l.sub_module_key, l.can_view, l.can_edit, l.can_delete, l.can_approve
    FROM lvl l JOIN best b ON b.module_key = l.module_key AND b.lv = l.lv
  UNION ALL
  SELECT rp.module_key, rp.sub_module_key, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
    FROM public.role_permissions rp JOIN me ON rp.role_key = me.role_key
   WHERE NOT EXISTS (SELECT 1 FROM best b WHERE b.module_key = rp.module_key);
$$;

-- 2) Action check: explicit action row, else the module row, else no rule.
CREATE OR REPLACE FUNCTION public.current_user_action_allowed(_module_key text, _sub_module_key text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    public.current_user_explicit_permission(_module_key, _sub_module_key, _action),
    public.current_user_explicit_permission(_module_key, '', _action));
$$;
GRANT EXECUTE ON FUNCTION public.current_user_action_allowed(text,text,text) TO authenticated;

-- 3) Generic guard. TG_ARGV: module, sub-module, mode ('all' or 'create_delete').
CREATE OR REPLACE FUNCTION public.enforce_rbac_table_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _act text := CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'edit' END;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user()
     OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(TG_ARGV[2], 'all') = 'create_delete' THEN RETURN NEW; END IF;
  IF public.current_user_action_allowed(TG_ARGV[0], TG_ARGV[1], _act) IS FALSE THEN
    RAISE EXCEPTION 'You do not have % access here', _act USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- Clients: contract saves also touch units, so only create/delete are guarded here.
    ('units','organizations','unit_manager','create_delete'),
    ('inv_purchase_orders','inventory','purchase_orders','all'),
    ('inv_po_lines','inventory','purchase_orders','all'),
    ('inv_transfers','inventory','transfers','create_delete'),
    ('inv_transfer_lines','inventory','transfers','create_delete'),
    ('inv_demands','inventory','demands','create_delete'),
    ('inv_demand_lines','inventory','demands','create_delete'),
    ('inv_goods_receipts','inventory','goods_receipts','create_delete'),
    ('inv_goods_receipt_lines','inventory','goods_receipts','create_delete'),
    ('inv_issuances','inventory','issuances','create_delete'),
    ('inv_issuance_lines','inventory','issuances','create_delete'),
    ('inv_adjustments','inventory','stock_report','all'),
    ('inv_adjustment_lines','inventory','stock_report','all'),
    ('field_visit_requests','field_sense','day_patrol','create_delete'),
    ('rec_candidates','recruitment','candidates','create_delete'),
    ('rec_interviews','recruitment','interviews','create_delete')
  ) t(tbl, m, s, mode) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS rbac_guard ON public.%I', r.tbl);
      EXECUTE format('CREATE TRIGGER rbac_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_table_permission(%L, %L, %L)', r.tbl, r.m, r.s, r.mode);
    END IF;
  END LOOP;
END $$;

-- 4) Access-defining employee fields: nobody but admins changes their own,
--    others need Employees → Edit details, and only admins can grant admin roles.
CREATE OR REPLACE FUNCTION public.guard_candidate_access_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user()
     OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role_key IS DISTINCT FROM OLD.role_key
     OR NEW.designation_id IS DISTINCT FROM OLD.designation_id
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.mobile IS DISTINCT FROM OLD.mobile THEN
    IF OLD.id = public.current_user_candidate_id() THEN
      RAISE EXCEPTION 'You cannot change your own role, designation, department or phone' USING ERRCODE = '42501';
    END IF;
    IF NEW.role_key IN ('super_admin','admin') THEN
      RAISE EXCEPTION 'Only an admin can grant admin access' USING ERRCODE = '42501';
    END IF;
    IF OLD.status IN ('approved','active','inactive')
       AND public.current_user_action_allowed('employees','edit','edit') IS FALSE THEN
      RAISE EXCEPTION 'You do not have permission to edit employee details' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_candidate_access_fields ON public.candidates;
CREATE TRIGGER guard_candidate_access_fields BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_access_fields();

NOTIFY pgrst, 'reload schema';
