-- Sub-module access for Employees, Recruitment, Sales & Marketing; Training Center
-- module; and database-enforced Edit/Delete on master-data tables.

-- Seed new sub-module rows from each role's current module grant (no change today).
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT rp.role_key, rp.module_key, s.k, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
FROM public.role_permissions rp
JOIN (VALUES
  ('employees','create'),('employees','edit'),('employees','wages'),('employees','offboard'),('employees','approvals'),
  ('recruitment','dashboard'),('recruitment','candidates'),('recruitment','openings'),('recruitment','interviews'),('recruitment','onboarding'),
  ('sales_marketing','dashboard'),('sales_marketing','prospects'),('sales_marketing','quotes')
) s(m,k) ON s.m = rp.module_key
WHERE COALESCE(rp.sub_module_key,'') = ''
ON CONFLICT (role_key, module_key, sub_module_key) DO NOTHING;

-- Same for department/designation/employee rules already in Access Control.
INSERT INTO public.access_overrides (scope_type, scope_id, department_id, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT o.scope_type, o.scope_id, o.department_id, o.module_key, s.k, o.can_view, o.can_edit, o.can_delete, o.can_approve
FROM public.access_overrides o
JOIN (VALUES
  ('employees','create'),('employees','edit'),('employees','wages'),('employees','offboard'),('employees','approvals'),
  ('recruitment','dashboard'),('recruitment','candidates'),('recruitment','openings'),('recruitment','interviews'),('recruitment','onboarding'),
  ('sales_marketing','dashboard'),('sales_marketing','prospects'),('sales_marketing','quotes')
) s(m,k) ON s.m = o.module_key
WHERE COALESCE(o.sub_module_key,'') = ''
  AND NOT EXISTS (SELECT 1 FROM public.access_overrides x WHERE x.scope_type=o.scope_type AND x.scope_id=o.scope_id
      AND x.department_id IS NOT DISTINCT FROM o.department_id AND x.module_key=o.module_key AND x.sub_module_key=s.k);

-- Generic guard: when Access Control explicitly withholds Edit/Delete for a
-- sub-module, the matching table refuses the write. TG_ARGV = module, sub-module.
CREATE OR REPLACE FUNCTION public.enforce_rbac_table_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _act text := CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'edit' END;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user()
     OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.current_user_explicit_permission(TG_ARGV[0], TG_ARGV[1], _act) IS FALSE THEN
    RAISE EXCEPTION 'You do not have % access here', _act USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('states','organizations','state_manager'),
    ('branches','organizations','branch_manager'),
    ('customers','organizations','organization_manager'),
    ('customer_gst_numbers','organizations','organization_manager'),
    ('vehicles','vehicles','vehicle_inventory'),
    ('vehicle_fastags','vehicles','fastag_manager'),
    ('vehicle_insurances','vehicles','insurance_manager'),
    ('vehicle_pucs','vehicles','puc_manager'),
    ('vehicle_fuel_entries','vehicles','expense_manager'),
    ('properties','assets','asset_inventory'),
    ('property_loans','assets','loan_manager'),
    ('property_expenses','assets','expense_manager'),
    ('inv_items','inventory','item_master'),
    ('inv_item_categories','inventory','item_master'),
    ('inv_item_sizes','inventory','item_master'),
    ('inv_size_charts','inventory','item_master'),
    ('inv_vendors','inventory','vendors'),
    ('inv_warehouses','inventory','warehouses'),
    ('inv_vendor_rate_cards','inventory','rate_cards'),
    ('inv_caps','inventory','inventory_caps'),
    ('crm_leads','sales_marketing','prospects'),
    ('crm_quotes','sales_marketing','quotes'),
    ('crm_quote_lines','sales_marketing','quotes'),
    ('rec_openings','recruitment','openings'),
    ('rec_opening_rounds','recruitment','openings'),
    ('employee_wages','employees','wages'),
    ('training_modules','training','')
  ) t(tbl, m, s) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS rbac_guard ON public.%I', r.tbl);
      EXECUTE format('CREATE TRIGGER rbac_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_table_permission(%L, %L)', r.tbl, r.m, r.s);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
