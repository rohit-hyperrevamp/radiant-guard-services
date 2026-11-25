-- 20261125000500_secdef_function_exposure.sql
-- RISK: LOW-MEDIUM - apply after a quick check of the screens listed below.
--
-- CLOSES: S14. SECURITY DEFINER functions callable by any signed-in user (and in
--   some cases anon via the default PUBLIC grant).
--
-- A) Not called from the browser (grep of src/ finds no rpc() call; callers are
--    pg_cron jobs or other SECURITY DEFINER functions, which run as the owner and
--    are unaffected) -> REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT service_role:
--      autofill_daily_attendance(), ensure_annual_gpaip_deductions(),
--      promote_due_contract_rates()  (also PERFORMed by approve_contract_rate_revision, which is SECURITY DEFINER -> still works),
--      send_task_due_reminders()      (cron 'task-due-reminders'),
--      get_user_ids_by_unit(uuid)     (only /api/public/hooks/daily-people-pings via supabaseAdmin),
--      dashboard_pnl_inputs(date,date,date) (company P&L; no caller in src/ at all - dashboard now
--                                       reads finance_period_totals. Revoking is stricter than a
--                                       permission check and needs no 200-line copy of the body.)
-- B) Called from the browser -> kept, but now return nothing unless permitted:
--      get_user_ids_by_role(text)     src/lib/workflows.ts:215 (rehire approval notifications)
--                                     -> active employee (is_current_employee_active) or service_role
--      get_user_ids_by_branch(uuid)   src/routes/admin.inventory.caps.tsx:269 + daily-people-pings (service)
--                                     -> admin, Inventory access (current_user_module_access) or service_role
--      list_active_field_officers()   src/routes/admin.customers.unit-manager.tsx:929
--                                     -> admin, Organizations / Employees / Field Sense view
--      find_rehire_candidate_by_aadhaar(text) src/routes/admin.employees.tsx:6676,7405 via workflows.ts:136
--                                     -> admin, Employees edit, onboarding submit/approve, or Recruitment
--    All checks use existing helpers; bodies are otherwise identical to the prior definitions.
--
-- AFFECTED SCREENS / ROLES: Employees -> Add employee (Aadhaar rehire lookup),
--   Clients -> Unit manager (field officer picker), Uniform Caps reminders,
--   rehire approval notifications. A user without the listed access now gets an
--   empty result instead of data (no error).
--
-- VERIFY AFTER APPLYING:
--   SELECT p.oid::regprocedure, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_exec,
--          has_function_privilege('anon', p.oid, 'EXECUTE') anon_exec
--   FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN
--   ('autofill_daily_attendance','ensure_annual_gpaip_deductions','promote_due_contract_rates',
--    'send_task_due_reminders','get_user_ids_by_unit','dashboard_pnl_inputs',
--    'get_user_ids_by_role','get_user_ids_by_branch','list_active_field_officers','find_rehire_candidate_by_aadhaar');
--   -- group A: auth_exec=f, anon_exec=f ; group B: auth_exec=t, anon_exec=f
--   SELECT jobname, status, start_time FROM cron.job_run_details d JOIN cron.job j USING (jobid)
--    WHERE jobname IN ('promote-contract-rates','task-due-reminders') ORDER BY start_time DESC LIMIT 5;  -- still succeeding
--   UI: HR adds an employee with a known ex-employee Aadhaar -> rehire prompt appears;
--       Unit manager field-officer dropdown is populated; as a guard both return empty.

BEGIN;

-- Snapshot current ACLs (first run only) for an exact rollback.
INSERT INTO review_fix_202611.acl_snapshot(migration, object_type, object_name, acl)
SELECT '20261125000500', 'function', p.oid::regprocedure::text, p.proacl::text
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('autofill_daily_attendance','ensure_annual_gpaip_deductions','promote_due_contract_rates',
                    'send_task_due_reminders','get_user_ids_by_unit','dashboard_pnl_inputs',
                    'get_user_ids_by_role','get_user_ids_by_branch','list_active_field_officers',
                    'find_rehire_candidate_by_aadhaar')
ON CONFLICT (migration, object_type, object_name) DO NOTHING;

-- A) server/cron only
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.autofill_daily_attendance()',
    'public.ensure_annual_gpaip_deductions()',
    'public.promote_due_contract_rates()',
    'public.send_task_due_reminders()',
    'public.get_user_ids_by_unit(uuid)',
    'public.dashboard_pnl_inputs(date,date,date)'
  ] LOOP
    IF to_regprocedure(f) IS NULL THEN RAISE NOTICE 'skip missing %', f; CONTINUE; END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- B) browser-called: same bodies + permission gate.
CREATE OR REPLACE FUNCTION public.get_user_ids_by_role(_role_key text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT u.id
  FROM auth.users u
  JOIN public.candidates c
    ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
  WHERE c.role_key = _role_key
    AND c.status IN ('active','approved')
    AND COALESCE(c.is_enabled, true) = true
    AND (COALESCE(auth.role(), '') = 'service_role' OR public.is_current_employee_active());
$$;

CREATE OR REPLACE FUNCTION public.get_user_ids_by_branch(_branch_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT u.id
  FROM auth.users u
  JOIN public.candidates c
    ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
  JOIN public.employee_scope_assignments esa
    ON esa.candidate_id = c.id
  WHERE esa.scope_type = 'branch'
    AND esa.scope_id::text = _branch_id::text
    AND c.status = 'active'
    AND c.role_key IN ('branch_admin','branch_manager','admin','super_admin')
    AND (COALESCE(auth.role(), '') = 'service_role'
         OR public.is_admin_user()
         OR public.current_user_module_access('inventory', 'view'));
$$;

CREATE OR REPLACE FUNCTION public.list_active_field_officers()
RETURNS TABLE(id uuid, full_name text, employee_code text, mobile text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.full_name, c.employee_code, c.mobile, c.status
  FROM public.candidates c
  WHERE c.role_key = 'field_officer'
    AND c.status IN ('approved','active')
    AND (COALESCE(auth.role(), '') = 'service_role'
         OR public.is_admin_user()
         OR public.current_user_module_access('organizations', 'view')
         OR public.current_user_module_access('employees', 'view')
         OR public.current_user_module_access('field_sense', 'view'))
  ORDER BY c.full_name;
$$;

CREATE OR REPLACE FUNCTION public.find_rehire_candidate_by_aadhaar(_aadhaar text)
RETURNS TABLE(
  id uuid,
  full_name text,
  employee_code text,
  candidate_code text,
  mobile text,
  status text,
  aadhaar_number text,
  unit_id uuid,
  resignation_url text,
  id_card_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.full_name,
    c.employee_code,
    c.candidate_code,
    c.mobile,
    c.status,
    c.aadhaar_number,
    c.unit_id,
    (
      SELECT d.value ->> 'file_url'
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents') = 'array'
            THEN COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents'
          ELSE '[]'::jsonb
        END
      ) AS d
      WHERE d.value ->> 'key' = 'resignation_letter'
        AND COALESCE(d.value ->> 'file_url', '') <> ''
      LIMIT 1
    ) AS resignation_url,
    (
      SELECT d.value ->> 'file_url'
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents') = 'array'
            THEN COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents'
          ELSE '[]'::jsonb
        END
      ) AS d
      WHERE d.value ->> 'key' = 'id_card_photo'
        AND COALESCE(d.value ->> 'file_url', '') <> ''
      LIMIT 1
    ) AS id_card_url
  FROM public.candidates c
  WHERE regexp_replace(COALESCE(c.aadhaar_number, ''), '\D', '', 'g') = regexp_replace(COALESCE(_aadhaar, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(_aadhaar, ''), '\D', '', 'g') <> ''
    AND (public.is_admin_user()
         OR public.current_user_module_access('employees', 'edit')
         OR public.current_user_can_submit_onboarding()
         OR public.current_user_can_approve_onboarding()
         OR public.current_user_can_recruit())
  ORDER BY c.created_at DESC
  LIMIT 1;
$$;

-- Group B keeps its browser grant but never anon.
REVOKE ALL ON FUNCTION public.get_user_ids_by_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_ids_by_branch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_active_field_officers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_rehire_candidate_by_aadhaar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_ids_by_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_ids_by_branch(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_active_field_officers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_rehire_candidate_by_aadhaar(text) TO authenticated, service_role;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually)
-- ======================================================================
-- BEGIN;
-- -- 1) Prior function bodies (verbatim from the repo):
-- --    get_user_ids_by_role:  supabase/migrations/20260728150225_ebe233b9-...sql
-- CREATE OR REPLACE FUNCTION public.get_user_ids_by_role(_role_key text)
-- RETURNS TABLE(user_id uuid)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
--   SELECT DISTINCT u.id
--   FROM auth.users u
--   JOIN public.candidates c
--     ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
--   WHERE c.role_key = _role_key
--     AND c.status IN ('active','approved')
--     AND COALESCE(c.is_enabled, true) = true;
-- $$;
-- --    get_user_ids_by_branch: supabase/migrations/20260625120311_18d5505e-...sql
-- CREATE OR REPLACE FUNCTION public.get_user_ids_by_branch(_branch_id uuid)
-- RETURNS TABLE(user_id uuid)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT DISTINCT u.id
--   FROM auth.users u
--   JOIN public.candidates c
--     ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
--   JOIN public.employee_scope_assignments esa
--     ON esa.candidate_id = c.id
--   WHERE esa.scope_type = 'branch'
--     AND esa.scope_id::text = _branch_id::text
--     AND c.status = 'active'
--     AND c.role_key IN ('branch_admin','branch_manager','admin','super_admin');
-- $$;
-- --    list_active_field_officers: supabase/migrations/20260714164808_ac9553e8-...sql
-- CREATE OR REPLACE FUNCTION public.list_active_field_officers()
-- RETURNS TABLE(id uuid, full_name text, employee_code text, mobile text, status text)
-- LANGUAGE sql
-- STABLE SECURITY DEFINER
-- SET search_path = public
-- AS $$
--   SELECT c.id, c.full_name, c.employee_code, c.mobile, c.status
--   FROM public.candidates c
--   WHERE c.role_key = 'field_officer'
--     AND c.status IN ('approved','active')
--   ORDER BY c.full_name;
-- $$;
-- --    find_rehire_candidate_by_aadhaar: supabase/migrations/20260729070329_e2421316-...sql
-- --    (identical to the version above WITHOUT the final "AND (public.is_admin_user() OR ...)" block)
-- CREATE OR REPLACE FUNCTION public.find_rehire_candidate_by_aadhaar(_aadhaar text)
-- RETURNS TABLE(id uuid, full_name text, employee_code text, candidate_code text, mobile text, status text,
--   aadhaar_number text, unit_id uuid, resignation_url text, id_card_url text)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$
--   SELECT c.id, c.full_name, c.employee_code, c.candidate_code, c.mobile, c.status, c.aadhaar_number, c.unit_id,
--     (SELECT d.value ->> 'file_url' FROM jsonb_array_elements(
--        CASE WHEN jsonb_typeof(COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents') = 'array'
--             THEN COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents' ELSE '[]'::jsonb END) AS d
--      WHERE d.value ->> 'key' = 'resignation_letter' AND COALESCE(d.value ->> 'file_url', '') <> '' LIMIT 1) AS resignation_url,
--     (SELECT d.value ->> 'file_url' FROM jsonb_array_elements(
--        CASE WHEN jsonb_typeof(COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents') = 'array'
--             THEN COALESCE(c.offboarding_details, '{}'::jsonb) -> 'exit_documents' ELSE '[]'::jsonb END) AS d
--      WHERE d.value ->> 'key' = 'id_card_photo' AND COALESCE(d.value ->> 'file_url', '') <> '' LIMIT 1) AS id_card_url
--   FROM public.candidates c
--   WHERE regexp_replace(COALESCE(c.aadhaar_number, ''), '\D', '', 'g') = regexp_replace(COALESCE(_aadhaar, ''), '\D', '', 'g')
--     AND regexp_replace(COALESCE(_aadhaar, ''), '\D', '', 'g') <> ''
--   ORDER BY c.created_at DESC
--   LIMIT 1;
-- $$;
-- -- 2) Restore every snapshotted ACL exactly (PUBLIC / anon / authenticated entries).
-- DO $$
-- DECLARE s record; a record;
-- BEGIN
--   FOR s IN SELECT * FROM review_fix_202611.acl_snapshot WHERE migration = '20261125000500' LOOP
--     IF to_regprocedure(s.object_name) IS NULL THEN CONTINUE; END IF;
--     EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', s.object_name);
--     IF s.acl IS NULL THEN
--       EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', s.object_name);  -- NULL proacl = default PUBLIC execute
--     ELSE
--       FOR a IN SELECT CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(g.rolname) END AS who
--                FROM aclexplode(s.acl::aclitem[]) x LEFT JOIN pg_roles g ON g.oid = x.grantee
--                WHERE x.privilege_type = 'EXECUTE' AND (x.grantee = 0 OR g.rolname IN ('anon','authenticated','service_role')) LOOP
--         EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s', s.object_name, a.who);
--       END LOOP;
--     END IF;
--   END LOOP;
-- END $$;
-- COMMIT;
