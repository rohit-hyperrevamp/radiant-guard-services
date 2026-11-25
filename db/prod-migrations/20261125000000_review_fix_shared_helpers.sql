-- 20261125000000_review_fix_shared_helpers.sql
-- RISK: LOW (adds objects only; changes no existing behaviour).
--
-- WHAT IT DOES
--   Shared plumbing for the 2026-11-25 review-fix migrations (20261125xxxxxx_*):
--   1. Private schema review_fix_202611 (no grants to anon/authenticated) holding
--      snapshots of the exact live policies / ACLs / bucket flags each later
--      migration replaces, so every rollback restores the LIVE prior state (the
--      live DB has drifted from the repo, see live-test-log "Note: 9 tables ...").
--   2. review_fix_202611.restore_policies(migration, schema, table): drops the
--      policies currently on a table that the review fix created and recreates
--      the snapshotted ones verbatim.
--   3. public.current_user_candidate_ids(): every candidates.id linked to the
--      signed-in phone (rehires keep several rows with the same mobile; the
--      existing current_user_candidate_id() returns only one, see A11).
--   4. public.current_user_can_strict(module, sub_module, action): "explicit
--      Access Control row wins, else module grant, no row = deny", admin always.
--      Built only from existing helpers (is_admin_user, current_user_explicit_permission,
--      current_user_module_access) - nothing role-hardcoded.
--
-- AFFECTED SCREENS / ROLES: none (new objects only).
--
-- VERIFY AFTER APPLYING
--   SELECT to_regnamespace('review_fix_202611') IS NOT NULL;                        -- true
--   SELECT has_schema_privilege('authenticated','review_fix_202611','USAGE');       -- false
--   SELECT public.current_user_can_strict('payroll','','view');                     -- runs (false as postgres)
--   SELECT * FROM public.current_user_candidate_ids();                              -- empty as postgres

BEGIN;

CREATE SCHEMA IF NOT EXISTS review_fix_202611;
REVOKE ALL ON SCHEMA review_fix_202611 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS review_fix_202611.policy_snapshot (
  migration   text NOT NULL,
  schemaname  name NOT NULL,
  tablename   name NOT NULL,
  policyname  name NOT NULL,
  permissive  text NOT NULL,
  roles       name[] NOT NULL,
  cmd         text NOT NULL,
  qual        text,
  with_check  text,
  taken_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migration, schemaname, tablename, policyname)
);

CREATE TABLE IF NOT EXISTS review_fix_202611.acl_snapshot (
  migration    text NOT NULL,
  object_type  text NOT NULL,           -- 'table' | 'function' | 'bucket' | 'column'
  object_name  text NOT NULL,
  acl          text,                    -- relacl / proacl / attacl as text
  rls_enabled  boolean,
  extra        jsonb,
  taken_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migration, object_type, object_name)
);

REVOKE ALL ON ALL TABLES IN SCHEMA review_fix_202611 FROM PUBLIC, anon, authenticated;

-- Snapshot the current policies of one table, once per migration (a re-run never
-- overwrites the original pre-change snapshot).
CREATE OR REPLACE FUNCTION review_fix_202611.snapshot_policies(_migration text, _schema name, _table name)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE n integer;
BEGIN
  INSERT INTO review_fix_202611.policy_snapshot(migration, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
  SELECT _migration, p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
  FROM pg_policies p
  WHERE p.schemaname = _schema AND p.tablename = _table
  ON CONFLICT (migration, schemaname, tablename, policyname) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Restore: drop every policy on the table whose name starts with 'rf_' (all
-- review-fix policies use that prefix) plus any snapshotted name, then recreate
-- the snapshotted policies exactly.
CREATE OR REPLACE FUNCTION review_fix_202611.restore_policies(_migration text, _schema name, _table name)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE r record; n integer := 0; _roles text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM review_fix_202611.policy_snapshot s
                 WHERE s.migration = _migration AND s.schemaname = _schema AND s.tablename = _table) THEN
    RAISE NOTICE 'No snapshot for % %.% - nothing restored', _migration, _schema, _table;
    RETURN 0;
  END IF;
  FOR r IN SELECT p.policyname FROM pg_policies p
           WHERE p.schemaname = _schema AND p.tablename = _table
             AND (p.policyname LIKE 'rf\_%' ESCAPE '\'
                  OR p.policyname IN (SELECT s.policyname FROM review_fix_202611.policy_snapshot s
                                      WHERE s.migration = _migration AND s.schemaname = _schema AND s.tablename = _table)) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, _schema, _table);
  END LOOP;
  FOR r IN SELECT * FROM review_fix_202611.policy_snapshot s
           WHERE s.migration = _migration AND s.schemaname = _schema AND s.tablename = _table LOOP
    SELECT string_agg(CASE WHEN x = 'public' THEN 'public' ELSE quote_ident(x) END, ', ') INTO _roles FROM unnest(r.roles) x;
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, _schema, _table, r.permissive, r.cmd, _roles,
      CASE WHEN r.qual IS NOT NULL THEN ' USING (' || r.qual || ')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION review_fix_202611.snapshot_policies(text, name, name) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION review_fix_202611.restore_policies(text, name, name) FROM PUBLIC, anon, authenticated;

-- Every candidate row linked to the signed-in phone (rehires share a mobile).
CREATE OR REPLACE FUNCTION public.current_user_candidate_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id FROM public.candidates c
  WHERE public.current_user_mobile() IS NOT NULL
    AND c.mobile = public.current_user_mobile();
$$;
REVOKE ALL ON FUNCTION public.current_user_candidate_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_candidate_ids() TO authenticated, service_role;

-- Explicit Access Control row wins; otherwise the module grant; no row = deny.
CREATE OR REPLACE FUNCTION public.current_user_can_strict(_module_key text, _sub_module_key text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR COALESCE(
           CASE WHEN COALESCE(_sub_module_key, '') <> ''
                THEN public.current_user_explicit_permission(_module_key, _sub_module_key, _action) END,
           public.current_user_module_access(_module_key, _action),
           false);
$$;
REVOKE ALL ON FUNCTION public.current_user_can_strict(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_strict(text, text, text) TO authenticated, service_role;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually, only AFTER rolling back every later 20261125 file,
-- because they depend on these objects and on the snapshots):
-- ======================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.current_user_can_strict(text, text, text);
-- DROP FUNCTION IF EXISTS public.current_user_candidate_ids();
-- DROP SCHEMA IF EXISTS review_fix_202611 CASCADE;   -- deletes the snapshots too
-- COMMIT;
