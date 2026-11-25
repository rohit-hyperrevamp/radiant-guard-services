-- 20261125000200_revoke_anon_units_inventory.sql
-- RISK: LOW - apply now.
--
-- CLOSES: L2 / L3. public.units (4,329 sites with addresses, GPS, GST, PAN,
--   emergency contacts), public.inv_issuances (incl. otp_code) and
--   public.inv_goods_receipts are readable with only the anon key. Their SELECT
--   policies are written "TO public" and contain "NOT current_user_has_branch_scope()",
--   which is TRUE for a signed-out caller, so anon sees every row.
--   Fix: REVOKE ALL on these three tables from anon (table privilege, so RLS is
--   never reached). Policies are untouched; signed-in behaviour is unchanged.
--
-- PUBLIC PAGES CHECKED: src/routes/login.tsx, welcome.tsx, index.tsx,
--   privacy-policy.tsx, privacypolicy.tsx, request-data-deletion.tsx,
--   digilocker.callback.tsx and __root.tsx do not query units / inv_issuances /
--   inv_goods_receipts. The /api/public/hooks/* handlers use supabaseAdmin
--   (service_role). So no anon reader exists and no minimal public view is needed.
--
-- AFFECTED SCREENS / ROLES: none for signed-in users. Any external integration
--   that read these tables with the anon key (none found in repo) would stop.
--
-- NOT CLOSED HERE (documented in README): signed-in guards can still read all
--   units / inv_issuances.otp_code through "NOT current_user_has_branch_scope()"
--   (L18), and the issuance OTP is verified in the browser (admin.my-inventory.tsx:144).
--
-- VERIFY AFTER APPLYING:
--   SELECT has_table_privilege('anon','public.units','SELECT'),
--          has_table_privilege('anon','public.inv_issuances','SELECT'),
--          has_table_privilege('anon','public.inv_goods_receipts','SELECT');   -- f, f, f
--   curl "$SUPABASE_URL/rest/v1/units?select=id&limit=1" -H "apikey: <anon key>"  -> 401/permission denied
--   Sign in as a guard and as an admin: dashboard, Clients and Uniform pages still load.

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['units','inv_issuances','inv_goods_receipts'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    INSERT INTO review_fix_202611.acl_snapshot(migration, object_type, object_name, acl, rls_enabled)
    SELECT '20261125000200', 'table', 'public.' || t, c.relacl::text, c.relrowsecurity
    FROM pg_class c WHERE c.oid = ('public.' || t)::regclass
    ON CONFLICT (migration, object_type, object_name) DO NOTHING;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually) - re-grants exactly what anon held before.
-- WARNING: re-opens L2/L3.
-- ======================================================================
-- BEGIN;
-- DO $$
-- DECLARE s record; a record;
-- BEGIN
--   FOR s IN SELECT * FROM review_fix_202611.acl_snapshot WHERE migration = '20261125000200' LOOP
--     IF s.acl IS NULL THEN
--       EXECUTE format('GRANT ALL ON %s TO anon', s.object_name);   -- NULL acl = Supabase defaults (ALL)
--     ELSE
--       FOR a IN SELECT x.privilege_type FROM aclexplode(s.acl::aclitem[]) x
--                JOIN pg_roles g ON g.oid = x.grantee WHERE g.rolname = 'anon' LOOP
--         EXECUTE format('GRANT %s ON %s TO anon', a.privilege_type, s.object_name);
--       END LOOP;
--     END IF;
--   END LOOP;
-- END $$;
-- COMMIT;
