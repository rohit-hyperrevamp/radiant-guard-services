-- 20261125000100_lock_backup_tables.sql
-- RISK: LOW - apply now.
--
-- CLOSES: L1 / S7. 97 of 102 public `_bkp_*` / `backup_*` tables are readable with
--   the public anon key (bank details, salary structures, 42k attendance rows,
--   contract rates). This revokes ALL from anon and authenticated and enables
--   RLS (no policies = no rows) on every such table. Nothing is deleted.
--   service_role / postgres keep full access (SQL editor, scripts).
--
-- AFFECTED SCREENS / ROLES: none expected - no app code reads `_bkp_*`/`backup_*`
--   (grep src/ for "_bkp_" / "backup_" from() calls returns nothing). One-off
--   restore scripts must run as postgres/service_role (they already do).
--
-- REQUIRES: 20261125000000_review_fix_shared_helpers.sql (snapshot table).
--
-- VERIFY AFTER APPLYING (expect 0 rows):
--   SELECT tablename FROM pg_tables
--   WHERE schemaname='public' AND (tablename LIKE '\_bkp\_%' ESCAPE '\' OR tablename LIKE 'backup\_%' ESCAPE '\')
--     AND (has_table_privilege('anon', format('public.%I',tablename), 'SELECT')
--       OR has_table_privilege('authenticated', format('public.%I',tablename), 'SELECT')
--       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I',tablename)::regclass));
--   And from a browser/curl with only the anon key: GET /rest/v1/<a _bkp_ table>?limit=1 -> 401/403 (permission denied).

BEGIN;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname, c.relacl::text AS acl, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND (c.relname LIKE '\_bkp\_%' ESCAPE '\' OR c.relname LIKE 'backup\_%' ESCAPE '\')
  LOOP
    -- First run only: remember the original ACL and RLS flag for an exact rollback.
    INSERT INTO review_fix_202611.acl_snapshot(migration, object_type, object_name, acl, rls_enabled)
    VALUES ('20261125000100', 'table', 'public.' || quote_ident(t.relname), t.acl, t.relrowsecurity)
    ON CONFLICT (migration, object_type, object_name) DO NOTHING;

    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually). Restores, per table, exactly the privileges anon and
-- authenticated held before (from the snapshot) and the original RLS flag.
-- WARNING: this re-opens the L1 data leak.
-- ======================================================================
-- BEGIN;
-- DO $$
-- DECLARE s record; a record;
-- BEGIN
--   FOR s IN SELECT * FROM review_fix_202611.acl_snapshot
--            WHERE migration = '20261125000100' AND object_type = 'table' LOOP
--     IF to_regclass(s.object_name) IS NULL THEN CONTINUE; END IF;
--     IF s.acl IS NULL THEN
--       -- NULL relacl = owner defaults; Supabase default privileges had granted ALL to anon/authenticated.
--       EXECUTE format('GRANT ALL ON %s TO anon, authenticated', s.object_name);
--     ELSE
--       FOR a IN SELECT g.rolname, x.privilege_type
--                FROM aclexplode(s.acl::aclitem[]) x JOIN pg_roles g ON g.oid = x.grantee
--                WHERE g.rolname IN ('anon','authenticated') LOOP
--         EXECUTE format('GRANT %s ON %s TO %I', a.privilege_type, s.object_name, a.rolname);
--       END LOOP;
--     END IF;
--     IF NOT s.rls_enabled THEN
--       EXECUTE format('ALTER TABLE %s DISABLE ROW LEVEL SECURITY', s.object_name);
--     END IF;
--   END LOOP;
-- END $$;
-- COMMIT;
