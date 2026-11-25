-- 20261125000800_master_tables_wages_write_rls.sql
-- RISK: MEDIUM - apply after checking Access Control grants (pre-check below).
--
-- CLOSES: S8 (fail-open RBAC) and the employee_wages part of L18.
--   employee_wages and ~25 master tables have permissive write policies
--   USING (true) / WITH CHECK (true) for every signed-in user. The only brake is the
--   rbac_guard trigger, which refuses a write ONLY when Access Control explicitly
--   withholds Edit/Delete - so "no rule" = allowed (a guard could edit PT slabs,
--   payroll windows, platform flags in inv_settings, ...).
--
-- WHAT IT DOES (per table in the list below, dynamically against LIVE pg_policies):
--   1. Snapshots every current policy of the table (exact rollback).
--   2. Drops only PERMISSIVE INSERT/UPDATE/DELETE/ALL policies for authenticated/public
--      whose USING and WITH CHECK are both literally `true`. If such a policy was
--      FOR ALL, an equivalent rf_<table>_read USING (true) SELECT policy is added so
--      reads do not change.
--   3. Adds rf_<table>_insert / _update / _delete requiring
--        public.current_user_can_strict(module, sub_module, action)
--      = admin OR explicit Access Control row for that sub-module, else the module
--        grant; NO ROW = DENY. Built on current_user_explicit_permission /
--        current_user_module_access / is_admin_user - nothing role-hardcoded.
--   Reads stay as they are (authenticated) EXCEPT employee_wages, see below.
--   rbac_guard triggers stay in place (they still enforce explicit denials).
--
-- TABLE -> PERMISSION (module::sub_module) - matches src/lib/rbac-modules.ts and the
-- screen that writes it (python scan of src/ for insert/update/upsert/delete):
--   professional_tax_slabs control_center::professional_tax_manager (admin.professional-tax-manager)
--   labour_welfare_funds   control_center::lwf_manager            (admin.lwf-manager)
--   duties                 control_center::duty_manager           (admin.duty-manager)
--   attendance_codes       control_center::attendance_code_manager
--   service_types          control_center::service_type_manager
--   payroll_windows        control_center::payroll_manager        (admin.payroll-manager)
--   payroll_day_bases      control_center::payroll_days_manager
--   allowance_types        control_center::allowance_manager
--   addition_types         control_center::addition_type_manager
--   deduction_types        control_center::deduction_type_manager
--   billing_types          control_center::billing_type_manager
--   designations           control_center::designation_manager
--   departments            control_center::department_manager
--   cost_components        control_center::cost_component_manager
--   ex_services            control_center::ex_service_manager
--   offboarding_reasons    control_center::offboarding_reason_manager
--   esic_branches          control_center::esic_branch_manager
--   languages              control_center::language_manager
--   policies               control_center::policy_manager
--   company_document_templates control_center::company_documents
--   pincode_ranges         control_center (any Control Center edit)
--   states                 organizations::state_manager           (lib/admin-data.ts)
--   branches               organizations::branch_manager          (lib/admin-data.ts)
--   customers, customer_gst_numbers  organizations::organization_manager
--                          OR Invoice edit (InvoiceSplitSettings.tsx updates customers.invoice_split)
--                          OR Sales & Marketing edit / Contracts edit (OrgUnitChain.tsx creates orgs on conversion)
--   inv_settings           control_center::platform_settings (admin.platform-settings.tsx)
--                          OR Payroll edit (admin.payroll.$unitId.tsx ESI round-up toggle)
--                          OR inventory manager (current_user_is_inventory_manager)
--   employee_wages         writes: employees::wages Edit (delete also needs Edit: the
--                          employee form deletes stale wage rows as part of Save,
--                          admin.employees.tsx:7107).
--                          READ (replaces "Authenticated can view employee wages" USING true):
--                          own rows, admin, explicit employees::wages View (else Employees Edit = HR),
--                          Payroll view, Invoice view (finance). payroll-engine.ts reads wages
--                          for payroll users -> covered.
--
-- AFFECTED SCREENS / ROLES: every Control Center master screen, Organizations
--   (states/branches/orgs/GST), invoice split settings, prospect conversion,
--   platform settings, payroll ESI toggle, Employees -> wages tab. Users who only
--   worked because "no rule = allowed" now get "new row violates row-level security".
-- PRE-CHECK (who will LOSE write access - review before applying):
--   SELECT rp.role_key, rp.module_key, rp.sub_module_key, rp.can_edit, rp.can_delete
--   FROM public.role_permissions rp
--   WHERE rp.module_key IN ('control_center','organizations','employees','payroll','invoice','sales_marketing','contracts','inventory')
--     AND (rp.can_edit OR rp.can_delete) ORDER BY 1,2,3;
--   (plus access_overrides rows for the same modules). Anyone who edits masters today
--   without such a grant must be given one in Access Control BEFORE applying.
--
-- VERIFY AFTER APPLYING:
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname='public' AND cmd <> 'SELECT' AND (qual='true' OR with_check='true')
--     AND tablename IN (<list above>);                       -- 0 rows
--   View as a guard: update professional_tax_slabs / employee_wages -> RLS error;
--   select employee_wages -> own row only.
--   As HR / Control Center user with grants: edit a PT slab, save an employee wage -> works.

BEGIN;

DO $$
DECLARE
  r record; p record; _roles text; _had_all_true boolean;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('professional_tax_slabs', 'control_center', 'professional_tax_manager', NULL::text, NULL::text),
    ('labour_welfare_funds',   'control_center', 'lwf_manager', NULL, NULL),
    ('duties',                 'control_center', 'duty_manager', NULL, NULL),
    ('attendance_codes',       'control_center', 'attendance_code_manager', NULL, NULL),
    ('service_types',          'control_center', 'service_type_manager', NULL, NULL),
    ('payroll_windows',        'control_center', 'payroll_manager', NULL, NULL),
    ('payroll_day_bases',      'control_center', 'payroll_days_manager', NULL, NULL),
    ('allowance_types',        'control_center', 'allowance_manager', NULL, NULL),
    ('addition_types',         'control_center', 'addition_type_manager', NULL, NULL),
    ('deduction_types',        'control_center', 'deduction_type_manager', NULL, NULL),
    ('billing_types',          'control_center', 'billing_type_manager', NULL, NULL),
    ('designations',           'control_center', 'designation_manager', NULL, NULL),
    ('departments',            'control_center', 'department_manager', NULL, NULL),
    ('cost_components',        'control_center', 'cost_component_manager', NULL, NULL),
    ('ex_services',            'control_center', 'ex_service_manager', NULL, NULL),
    ('offboarding_reasons',    'control_center', 'offboarding_reason_manager', NULL, NULL),
    ('esic_branches',          'control_center', 'esic_branch_manager', NULL, NULL),
    ('languages',              'control_center', 'language_manager', NULL, NULL),
    ('policies',               'control_center', 'policy_manager', NULL, NULL),
    ('company_document_templates','control_center','company_documents', NULL, NULL),
    ('pincode_ranges',         'control_center', '', NULL, NULL),
    ('states',                 'organizations', 'state_manager', NULL, NULL),
    ('branches',               'organizations', 'branch_manager', NULL, NULL),
    ('customers', 'organizations', 'organization_manager',
       '(SELECT public.current_user_can_strict(''organizations'',''organization_manager'',''edit'')) OR (SELECT public.current_user_module_access(''invoice'',''edit'')) OR (SELECT public.current_user_module_access(''sales_marketing'',''edit'')) OR (SELECT public.current_user_module_access(''contracts'',''edit''))',
       '(SELECT public.current_user_can_strict(''organizations'',''organization_manager'',''delete''))'),
    ('customer_gst_numbers', 'organizations', 'organization_manager',
       '(SELECT public.current_user_can_strict(''organizations'',''organization_manager'',''edit'')) OR (SELECT public.current_user_module_access(''invoice'',''edit'')) OR (SELECT public.current_user_module_access(''sales_marketing'',''edit'')) OR (SELECT public.current_user_module_access(''contracts'',''edit''))',
       '(SELECT public.current_user_can_strict(''organizations'',''organization_manager'',''edit''))'),
    ('inv_settings', 'control_center', 'platform_settings',
       '(SELECT public.current_user_can_strict(''control_center'',''platform_settings'',''edit'')) OR (SELECT public.current_user_module_access(''payroll'',''edit'')) OR (SELECT public.current_user_is_inventory_manager())',
       '(SELECT public.current_user_can_strict(''control_center'',''platform_settings'',''delete''))'),
    ('employee_wages', 'employees', 'wages',
       '(SELECT public.current_user_can_strict(''employees'',''wages'',''edit''))',
       '(SELECT public.current_user_can_strict(''employees'',''wages'',''edit''))')
  ) t(tbl, m, s, edit_expr, delete_expr)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN RAISE NOTICE 'skip missing table %', r.tbl; CONTINUE; END IF;

    PERFORM review_fix_202611.snapshot_policies('20261125000800', 'public', r.tbl);

    _had_all_true := false;
    FOR p IN
      SELECT pp.policyname, pp.cmd FROM pg_policies pp
      WHERE pp.schemaname = 'public' AND pp.tablename = r.tbl
        AND pp.permissive = 'PERMISSIVE'
        AND pp.policyname NOT LIKE 'rf\_%' ESCAPE '\'
        AND pp.roles && ARRAY['authenticated','public']::name[]
        AND (pp.cmd IN ('INSERT','UPDATE','DELETE','ALL')
             OR (r.tbl = 'employee_wages' AND pp.cmd = 'SELECT'))
        AND COALESCE(pp.qual, 'true') = 'true'
        AND COALESCE(pp.with_check, 'true') = 'true'
    LOOP
      IF p.cmd = 'ALL' THEN _had_all_true := true; END IF;
      RAISE NOTICE 'drop %.% (%)', r.tbl, p.policyname, p.cmd;
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, r.tbl);
    END LOOP;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rf_' || r.tbl || '_insert', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rf_' || r.tbl || '_update', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rf_' || r.tbl || '_delete', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'rf_' || r.tbl || '_read', r.tbl);

    r.edit_expr := COALESCE(r.edit_expr, format('(SELECT public.current_user_can_strict(%L, %L, %L))', r.m, r.s, 'edit'));
    r.delete_expr := COALESCE(r.delete_expr, format('(SELECT public.current_user_can_strict(%L, %L, %L))', r.m, r.s, 'delete'));

    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   'rf_' || r.tbl || '_insert', r.tbl, r.edit_expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   'rf_' || r.tbl || '_update', r.tbl, r.edit_expr, r.edit_expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   'rf_' || r.tbl || '_delete', r.tbl, r.delete_expr);

    IF r.tbl = 'employee_wages' THEN
      EXECUTE $p$CREATE POLICY rf_employee_wages_read ON public.employee_wages FOR SELECT TO authenticated
        USING (
          candidate_id IN (SELECT public.current_user_candidate_ids())
          OR (SELECT public.is_admin_user())
          OR COALESCE((SELECT public.current_user_explicit_permission('employees','wages','view')),
                      (SELECT public.current_user_module_access('employees','edit')))
          OR (SELECT public.current_user_module_access('payroll','view'))
          OR (SELECT public.current_user_module_access('invoice','view'))
        )$p$;
    ELSIF _had_all_true THEN
      -- A dropped FOR ALL USING(true) policy also granted SELECT; keep reads identical.
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                     'rf_' || r.tbl || '_read', r.tbl);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually) - restores the exact LIVE policies captured at apply
-- time for every table above (drops all rf_* policies on them first).
-- Static reference for employee_wages (supabase/migrations/20260829034219_4a4fbee1-...sql):
--   "Authenticated can view/insert/update/delete employee wages" ... USING (true) / WITH CHECK (true).
-- The other dropped policies were the "Authenticated write/update/delete <table>"
-- USING (true) / WITH CHECK (true) policies from the original table migrations; the
-- RAISE NOTICE output of the apply run lists each one dropped.
-- ======================================================================
-- BEGIN;
-- DO $$
-- DECLARE t name;
-- BEGIN
--   FOR t IN SELECT DISTINCT tablename FROM review_fix_202611.policy_snapshot WHERE migration = '20261125000800' LOOP
--     PERFORM review_fix_202611.restore_policies('20261125000800', 'public', t);
--   END LOOP;
-- END $$;
-- COMMIT;
