-- Replace fixed role lists with Access Control, add participant-aware edit
-- guards for in-progress uniform records, and hide data when View is withheld.

-- New action switches that replace hard-coded role lists (seeded so today matches).
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT r, 'employees', 'mapping', true, true, false, false
FROM unnest(ARRAY['hr','leadership','operations_manager','vp_operations','admin','super_admin']) r
ON CONFLICT (role_key, module_key, sub_module_key) DO UPDATE SET can_view = true, can_edit = true;
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT r, 'attendance', 'all_units', true, false, false, false
FROM unnest(ARRAY['hr','leadership','branch_manager','admin','super_admin']) r
ON CONFLICT (role_key, module_key, sub_module_key) DO UPDATE SET can_view = true;
-- Leadership could add employees under the old fixed list; keep that.
UPDATE public.role_permissions SET can_edit = true
 WHERE role_key = 'leadership' AND module_key = 'employees' AND sub_module_key IN ('create','edit');
-- Copy into existing department/designation/employee rules for those modules.
INSERT INTO public.access_overrides (scope_type, scope_id, department_id, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT o.scope_type, o.scope_id, o.department_id, o.module_key, s.k, o.can_view, o.can_edit, false, false
FROM public.access_overrides o JOIN (VALUES ('employees','mapping'),('attendance','all_units')) s(m,k) ON s.m = o.module_key
WHERE COALESCE(o.sub_module_key,'') = ''
  AND NOT EXISTS (SELECT 1 FROM public.access_overrides x WHERE x.scope_type=o.scope_type AND x.scope_id=o.scope_id
      AND x.department_id IS NOT DISTINCT FROM o.department_id AND x.module_key=o.module_key AND x.sub_module_key=s.k);

CREATE OR REPLACE FUNCTION public.current_user_is_people_ops()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR COALESCE(public.current_user_action_allowed('employees','mapping','edit'), false);
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_approve_onboarding()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user() OR (public.is_current_employee_active()
     AND COALESCE(public.current_user_action_allowed('employees','approvals','approve'), false));
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_submit_onboarding()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user() OR (public.is_current_employee_active()
     AND COALESCE(public.current_user_action_allowed('employees','create','edit'), false));
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_unit_scope_assignments()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user() OR (public.is_current_employee_active()
     AND COALESCE(public.current_user_action_allowed('organizations','unit_manager','edit'), false));
$$;

-- Which units: "All units" switch, else the person's own unit/customer/site mapping.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_attendance_unit(_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.current_user_candidate_id() AS candidate_id)
  SELECT public.is_admin_user()
    OR COALESCE(public.current_user_action_allowed('attendance','all_units','view'), false)
    OR EXISTS (
      SELECT 1 FROM me WHERE
        EXISTS (SELECT 1 FROM public.employee_scope_assignments esa JOIN public.units u ON u.id = _unit_id
                WHERE esa.candidate_id = me.candidate_id
                  AND ((esa.scope_type = 'unit' AND esa.scope_id = _unit_id::text)
                    OR (esa.scope_type = 'customer' AND u.customer_id::text = esa.scope_id)))
        OR EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = me.candidate_id AND cu.unit_id = _unit_id));
$$;

-- Admin = admin roles only (removes phone numbers hard-coded as admins).
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.candidates c ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
    WHERE u.id = auth.uid() AND c.role_key IN ('admin','super_admin'));
$$;

-- Guard modes: 'all', 'create_delete', 'participant:<col,col>' (people named on
-- the record — receiver, requester, collector — may still update it).
CREATE OR REPLACE FUNCTION public.enforce_rbac_table_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _act text := CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'edit' END;
        _mode text := COALESCE(TG_ARGV[2], 'all'); _col text; _me text[];
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user() THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' AND _mode = 'create_delete' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND _mode LIKE 'participant:%' THEN
    _me := ARRAY[auth.uid()::text, public.current_user_candidate_id()::text];
    FOREACH _col IN ARRAY string_to_array(substr(_mode, 13), ',') LOOP
      IF (to_jsonb(OLD) ->> _col) = ANY(_me) OR (to_jsonb(NEW) ->> _col) = ANY(_me) THEN RETURN NEW; END IF;
    END LOOP;
  END IF;
  IF public.current_user_action_allowed(TG_ARGV[0], TG_ARGV[1], _act) IS FALSE THEN
    RAISE EXCEPTION 'You do not have % access here', _act USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('inv_transfers','inventory','transfers','participant:dispatched_by,received_by'),
    ('inv_transfer_lines','inventory','transfers','create_delete'),
    ('inv_demands','inventory','demands','participant:requester_id,requester_candidate_id'),
    ('inv_goods_receipts','inventory','goods_receipts','participant:received_by'),
    ('inv_issuances','inventory','issuances','participant:destination_id,received_by,collected_by,issued_by')
  ) t(tbl, m, s, mode) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS rbac_guard ON public.%I', r.tbl);
    EXECUTE format('CREATE TRIGGER rbac_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_table_permission(%L, %L, %L)', r.tbl, r.m, r.s, r.mode);
  END LOOP;
END $$;

-- View withheld => rows hidden (restrictive policy; no rule => existing policies decide).
CREATE OR REPLACE FUNCTION public.current_user_view_allowed(_module_key text, _sub_module_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR public.current_user_action_allowed(_module_key, _sub_module_key, 'view') IS NOT FALSE;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_view_allowed(text,text) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('vehicles','vehicles','vehicle_inventory'), ('vehicle_fastags','vehicles','fastag_manager'),
    ('vehicle_insurances','vehicles','insurance_manager'), ('vehicle_pucs','vehicles','puc_manager'),
    ('vehicle_fuel_entries','vehicles','expense_manager'), ('properties','assets','asset_inventory'),
    ('property_loans','assets','loan_manager'), ('property_expenses','assets','expense_manager'),
    ('inv_vendor_rate_cards','inventory','rate_cards'),
    ('crm_leads','sales_marketing','prospects'), ('crm_lead_requirements','sales_marketing','prospects'),
    ('crm_activities','sales_marketing','prospects'), ('crm_quotes','sales_marketing','quotes'),
    ('crm_quote_lines','sales_marketing','quotes'), ('rec_openings','recruitment','openings'),
    ('rec_opening_rounds','recruitment','openings'), ('employee_wages','employees','wages')
  ) t(tbl, m, s) LOOP
    EXECUTE format('DROP POLICY IF EXISTS rbac_view_guard ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY rbac_view_guard ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.current_user_view_allowed(%L, %L)))', r.tbl, r.m, r.s);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
