-- 20261125001200_candidates_pii_column_revoke.sql
-- RISK: HIGH - NOT AUTO-APPLY-SAFE. Requires the app changes listed in
--       db/prod-migrations/20261125_REVIEW_FIXES_README.md ("App changes required
--       before 20261125001200") to be DEPLOYED FIRST. The migration refuses to run
--       unless you explicitly confirm in the same session:
--           SET radiant.confirm_pii_column_revoke = 'yes';
--
-- CLOSES: S9 / L18 (PII part). A guard session can read 6,018 employees with bank
--   account / Aadhaar / PAN through the "teammates in my unit / department"
--   candidates policies, which return whole rows.
--
-- WHAT IT DOES
--   1. Column privileges: REVOKE table-level SELECT on public.candidates from
--      authenticated and anon, then GRANT SELECT on every column EXCEPT
--      aadhaar_number, pan_number, bank_account_number, bank_ifsc back to
--      authenticated. (A column-only REVOKE would do nothing while the table-level
--      SELECT grant exists.) INSERT / UPDATE / DELETE privileges and all RLS
--      policies are unchanged, so HR can still WRITE these fields.
--   2. Accessor RPC for HR / payroll / onboarding screens:
--        public.get_candidate_pii(_candidate_ids uuid[])
--          RETURNS (id, aadhaar_number, pan_number, bank_account_number, bank_ifsc)
--      SECURITY INVOKER wrapper: keeps only ids the caller can already see under the
--      existing candidates RLS, then calls public.candidate_pii_rows(uuid[])
--      (SECURITY DEFINER) which returns a row only when the caller is the person
--      (current_user_candidate_ids) or passes public.current_user_can_view_candidate_pii():
--        admin OR Employees edit OR explicit employees::wages view OR Payroll view
--        OR payroll processor / onboarding approver / Recruitment access.
--
-- CONSEQUENCES (why HIGH): every PostgREST request by a signed-in user that names
--   one of the four columns, uses select("*") on candidates, embeds candidates(*),
--   or returns a candidates row with "*" after insert/update fails with
--   "permission denied for table candidates" (42501). Server code using
--   supabaseAdmin (service_role) and SECURITY DEFINER functions (approval_decide,
--   rec_onboard_candidate, find_rehire_candidate_by_aadhaar, ...) are unaffected.
--   Columns added to candidates later are NOT readable by authenticated until granted
--   (re-run the GRANT block below after any ALTER TABLE candidates ADD COLUMN).
--
-- AFFECTED SCREENS: Employees list/detail/edit/export, Profile, Candidate details,
--   statutory forms, compliance registers/templates, company documents, document
--   export, payroll engine (bank file), rehire flow - see README list.
--
-- VERIFY AFTER APPLYING:
--   SELECT has_column_privilege('authenticated','public.candidates','aadhaar_number','SELECT'),  -- f
--          has_column_privilege('authenticated','public.candidates','full_name','SELECT'),       -- t
--          has_table_privilege('anon','public.candidates','SELECT');                             -- f
--   View as a guard: GET /rest/v1/candidates?select=id,aadhaar_number -> 42501;
--                    GET /rest/v1/candidates?select=id,full_name      -> teammates as before.
--   As HR: rpc('get_candidate_pii', {_candidate_ids:[<id>]}) -> one row with the values.
--   Employees page, profile, payroll bank export all load (after the app change).

BEGIN;

DO $$
BEGIN
  IF COALESCE(current_setting('radiant.confirm_pii_column_revoke', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'HIGH RISK migration 20261125001200: deploy the app changes first, then run  SET radiant.confirm_pii_column_revoke = ''yes'';  in this session and re-run.';
  END IF;
END $$;

-- Snapshot (first run only): table ACL and per-column ACLs of candidates.
INSERT INTO review_fix_202611.acl_snapshot(migration, object_type, object_name, acl)
SELECT '20261125001200', 'table', 'public.candidates', c.relacl::text
FROM pg_class c WHERE c.oid = 'public.candidates'::regclass
ON CONFLICT (migration, object_type, object_name) DO NOTHING;
INSERT INTO review_fix_202611.acl_snapshot(migration, object_type, object_name, acl)
SELECT '20261125001200', 'column', a.attname, a.attacl::text
FROM pg_attribute a
WHERE a.attrelid = 'public.candidates'::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
ON CONFLICT (migration, object_type, object_name) DO NOTHING;

DO $$
DECLARE _cols text;
BEGIN
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO _cols
  FROM pg_attribute a
  WHERE a.attrelid = 'public.candidates'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attname NOT IN ('aadhaar_number','pan_number','bank_account_number','bank_ifsc');
  EXECUTE 'REVOKE SELECT ON public.candidates FROM anon, authenticated';
  EXECUTE 'REVOKE SELECT (aadhaar_number, pan_number, bank_account_number, bank_ifsc) ON public.candidates FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.candidates TO authenticated', _cols);
END $$;

CREATE OR REPLACE FUNCTION public.current_user_can_view_candidate_pii()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR public.current_user_module_access('employees', 'edit')
      OR COALESCE(public.current_user_explicit_permission('employees', 'wages', 'view'), false)
      OR public.current_user_module_access('payroll', 'view')
      OR COALESCE(public.current_user_can_process_payroll(), false)
      OR COALESCE(public.current_user_can_approve_onboarding(), false)
      OR COALESCE(public.current_user_can_recruit(), false);
$$;

CREATE OR REPLACE FUNCTION public.candidate_pii_rows(_candidate_ids uuid[])
RETURNS TABLE(id uuid, aadhaar_number text, pan_number text, bank_account_number text, bank_ifsc text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.aadhaar_number::text, c.pan_number::text, c.bank_account_number::text, c.bank_ifsc::text
  FROM public.candidates c
  WHERE c.id = ANY(COALESCE(_candidate_ids, ARRAY[]::uuid[]))
    AND (c.id IN (SELECT public.current_user_candidate_ids())
         OR public.current_user_can_view_candidate_pii());
$$;

-- Invoker wrapper: candidates RLS decides which ids the caller may see at all.
CREATE OR REPLACE FUNCTION public.get_candidate_pii(_candidate_ids uuid[])
RETURNS TABLE(id uuid, aadhaar_number text, pan_number text, bank_account_number text, bank_ifsc text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.* FROM public.candidate_pii_rows(
    ARRAY(SELECT c.id FROM public.candidates c WHERE c.id = ANY(COALESCE(_candidate_ids, ARRAY[]::uuid[])))
  ) p;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_view_candidate_pii() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.candidate_pii_rows(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_candidate_pii(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_candidate_pii() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.candidate_pii_rows(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_candidate_pii(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually). Restores table-level SELECT exactly as snapshotted
-- (Supabase default = SELECT for anon and authenticated) and removes the
-- column-level grants and the accessor functions.
-- ======================================================================
-- BEGIN;
-- DO $$
-- DECLARE s record; a record; _cols text;
-- BEGIN
--   SELECT string_agg(quote_ident(attname), ', ') INTO _cols FROM pg_attribute
--   WHERE attrelid = 'public.candidates'::regclass AND attnum > 0 AND NOT attisdropped;
--   EXECUTE format('REVOKE SELECT (%s) ON public.candidates FROM authenticated', _cols);
--   SELECT * INTO s FROM review_fix_202611.acl_snapshot
--    WHERE migration = '20261125001200' AND object_type = 'table' AND object_name = 'public.candidates';
--   IF s.acl IS NULL THEN
--     EXECUTE 'GRANT SELECT ON public.candidates TO anon, authenticated';
--   ELSE
--     FOR a IN SELECT g.rolname FROM aclexplode(s.acl::aclitem[]) x JOIN pg_roles g ON g.oid = x.grantee
--              WHERE x.privilege_type = 'SELECT' AND g.rolname IN ('anon','authenticated') LOOP
--       EXECUTE format('GRANT SELECT ON public.candidates TO %I', a.rolname);
--     END LOOP;
--   END IF;
--   -- Column ACLs that existed before (normally none) are listed in acl_snapshot object_type='column'.
-- END $$;
-- DROP FUNCTION IF EXISTS public.get_candidate_pii(uuid[]);
-- DROP FUNCTION IF EXISTS public.candidate_pii_rows(uuid[]);
-- DROP FUNCTION IF EXISTS public.current_user_can_view_candidate_pii();
-- NOTIFY pgrst, 'reload schema';
-- COMMIT;
