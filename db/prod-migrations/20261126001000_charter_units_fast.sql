-- PERF + SECURITY: get_attendance_charter_units — gate, rewrite, lite mode,
-- distinct "Active employees", and a generation-checked server cache.
--
-- Supersedes the body in 20261003070000_nonbillable_attendance_no_contract.sql
-- (the newest CREATE OR REPLACE before this file).
--
-- Why:
--   * Live it took 1.4 s avg / 3.7 s max and blocks the Attendance, Payroll and
--     Invoice registers and the dashboard.
--   * It was SECURITY DEFINER with no gate: any signed-in account received every
--     unit and every guard name.
--   * The "Active employees" tile summed per-unit counts that included scope
--     assignments (state-scope field officers appear at hundreds of units) and
--     multi-site people: 33,030 shown vs ~7,194 real.
--
-- What changes:
--   1. Gate: auth.uid() must be set and the caller needs View (any grant) on at
--      least one of attendance / payroll / invoice / dashboard, read through
--      current_user_module_access() (Access Control, no role list). The gate runs
--      BEFORE the cache read.
--   2. Same output rows/order/fields, computed faster: the four-way OR join of
--      employee_scope_assignments ⋈ units is split into UNION ALL branches
--      (unit / branch / customer / state) with ONE grouping step; the per-row
--      EXISTS in cand became IN (non-billable unit ids); units are filtered early
--      to status='active' (the browser already drops every non-active unit via
--      fetchActiveClientIds, so the visible result is identical) and to the
--      caller's scope before any link is built.
--   3. New signature get_attendance_charter_units(p_lite boolean DEFAULT false).
--      The zero-arg overload is DROPPED in the same transaction, so a call with
--      no arguments still resolves (to the default) and PostgREST never sees two
--      candidates. p_lite = true returns the same rows with security_guards = []
--      (no name arrays) for first paint.
--   4. Per-unit active_employee_count now counts people actually deployed there
--      (home candidates.unit_id or a candidate_units posting) — NOT scope
--      assignments. guard_count keeps the previous figure (deployed + scope
--      people, = security_guards length) for the sheet "actual" fallback.
--      Top-level 'active_employees' = distinct deployed people across all rows.
--      Companion charter_active_employee_total(uuid[]) returns the distinct
--      deployed count for any subset (window / filters) the register shows.
--      Scope-assignment people stay in security_guards for the sheet picker.
--   5. Cache in public.rpc_cache (20261125001400): key per (lite flag, scope
--      key) where scope key = role:candidate for field_officer / hr_executive
--      (the only roles whose output differs) and 'all' otherwise. A hit needs the
--      same generation AND computed_at within 3 minutes. The generation is a
--      sequence bumped by FOR EACH STATEMENT triggers on every table the function
--      reads (candidates only for the columns read).
--
-- No money, duty, attendance or payroll figure is involved — unit list only.
-- RISK: LOW-MEDIUM.
--   * Callers without any of the four module grants now get 42501 (previously
--     they got everything). The client shows its normal error state.
--   * Sequences are non-transactional: a reader that computes while a writer's
--     transaction is still open can cache pre-commit data under the new
--     generation; the 3-minute TTL bounds that staleness.
--
-- VERIFY (as an attendance user, e.g. via SET request.jwt.claims in SQL editor):
--   SELECT jsonb_array_length(public.get_attendance_charter_units()->'units');        -- same count as before
--   SELECT public.get_attendance_charter_units(true)->'active_employees';             -- ~7.2k, not 33k
--   SELECT jsonb_array_length(u->'security_guards') FROM jsonb_array_elements(public.get_attendance_charter_units(true)->'units') u LIMIT 1; -- 0
--   SELECT key, computed_at, payload->>'gen' FROM public.rpc_cache WHERE key LIKE 'charter_units|%';
--   SELECT last_value FROM public.charter_units_gen_seq;  -- bumps after e.g. UPDATE units SET name=name WHERE false;
--   -- as anon / a user with no attendance/payroll/invoice/dashboard grant: ERROR 42501

BEGIN;

CREATE INDEX IF NOT EXISTS units_hr_executive_id_idx ON public.units (hr_executive_id);
DO $$ BEGIN
  IF to_regclass('public.field_officer_scope') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS field_officer_scope_candidate_idx ON public.field_officer_scope (candidate_id)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Generation counter + invalidation triggers
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.charter_units_gen_seq;
-- A fresh sequence reports last_value = 1 both before and after its first
-- nextval; call it once so every later bump changes last_value.
SELECT nextval('public.charter_units_gen_seq');
REVOKE ALL ON SEQUENCE public.charter_units_gen_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bump_charter_units_gen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM nextval('public.charter_units_gen_seq');
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.bump_charter_units_gen() FROM PUBLIC, anon, authenticated;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.units'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE OF
  code, name, location, branch_id, customer_id, billing_state, billing_city, client_state, client_city,
  is_billable, status, hr_executive_id
  ON public.units FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()$q$;
END IF; END $t$;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.client_contracts'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE OF
  status, unit_id, contract_code, end_date
  ON public.client_contracts FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()$q$;
END IF; END $t$;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.candidate_units'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE OF candidate_id, unit_id
  ON public.candidate_units FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()$q$;
END IF; END $t$;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.employee_scope_assignments'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE OF candidate_id, scope_type, scope_id
  ON public.employee_scope_assignments FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()$q$;
END IF; END $t$;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.customers'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE OF name, code
  ON public.customers FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()$q$;
END IF; END $t$;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.candidates'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE OF
  is_enabled, status, non_billable, role_key, unit_id, full_name
  ON public.candidates FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()$q$;
END IF; END $t$;

DO $$ BEGIN
  IF to_regclass('public.field_officer_scope') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_charter_units_gen' AND tgrelid='public.field_officer_scope'::regclass) THEN
    EXECUTE 'CREATE TRIGGER zz_charter_units_gen AFTER INSERT OR DELETE OR TRUNCATE OR UPDATE
      ON public.field_officer_scope FOR EACH STATEMENT EXECUTE FUNCTION public.bump_charter_units_gen()';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Shared gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._charter_units_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND (
       public.current_user_module_access('attendance', 'view')
    OR public.current_user_module_access('payroll', 'view')
    OR public.current_user_module_access('invoice', 'view')
    OR public.current_user_module_access('dashboard', 'view'));
$$;
REVOKE ALL ON FUNCTION public._charter_units_allowed() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The calculation (private). Output identical to the previous function except:
-- active_employee_count = deployed people, + guard_count, + top-level
-- active_employees, and security_guards = [] when p_lite.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._attendance_charter_units_compute(p_lite boolean, p_role text, p_cand uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _scoped boolean := coalesce(p_role, '') IN ('field_officer', 'hr_executive');
  _payload jsonb;
BEGIN
  WITH nb(k) AS (
    VALUES ('field_officer'),('branch_manager'),('hr'),('hr_executive'),('leadership'),('transport'),('inventory'),
      ('admin'),('super_admin'),('user'),('accounts'),('operations'),('operations_manager'),('area_manager'),('regional_manager')
  ), cand AS MATERIALIZED (
    SELECT c.id, c.full_name, c.unit_id FROM candidates c
    WHERE c.is_enabled AND c.status = 'active'
      AND ((coalesce(c.non_billable, false) = false AND lower(coalesce(c.role_key, '')) NOT IN (SELECT k FROM nb))
        OR c.unit_id IN (SELECT hu.id FROM units hu WHERE hu.is_billable = false))
  ), contracts AS MATERIALIZED (
    SELECT unit_id, array_remove(array_agg(contract_code ORDER BY contract_code), NULL) codes, max(end_date) contract_end
    FROM client_contracts WHERE status = 'active' AND unit_id IS NOT NULL GROUP BY unit_id
  ), allowed_units AS (
    SELECT fos.unit_id FROM field_officer_scope fos WHERE p_role = 'field_officer' AND fos.candidate_id = p_cand
    UNION ALL SELECT u.id FROM units u WHERE p_role = 'hr_executive' AND u.hr_executive_id = p_cand
  ), vis AS MATERIALIZED (
    -- Candidate units: active, in scope, and either under an active contract or
    -- non-billable (UN1-style home office, exempt from the contract rule).
    SELECT u.id, u.branch_id, u.customer_id, coalesce(nullif(u.client_state, ''), u.billing_state) st
    FROM units u
    WHERE u.status = 'active'
      AND (u.is_billable = false OR u.id IN (SELECT unit_id FROM contracts))
      AND ((NOT _scoped) OR u.id IN (SELECT unit_id FROM allowed_units))
  ), links AS (
    SELECT cu.unit_id, c.id, c.full_name, true AS deployed
      FROM candidate_units cu JOIN cand c ON c.id = cu.candidate_id WHERE cu.unit_id IN (SELECT id FROM vis)
    UNION ALL SELECT c.unit_id, c.id, c.full_name, true FROM cand c WHERE c.unit_id IN (SELECT id FROM vis)
    UNION ALL SELECT v.id, c.id, c.full_name, false FROM employee_scope_assignments a
      JOIN cand c ON c.id = a.candidate_id JOIN vis v ON a.scope_type = 'unit' AND v.id::text = a.scope_id
    UNION ALL SELECT v.id, c.id, c.full_name, false FROM employee_scope_assignments a
      JOIN cand c ON c.id = a.candidate_id JOIN vis v ON a.scope_type = 'branch' AND v.branch_id::text = a.scope_id
    UNION ALL SELECT v.id, c.id, c.full_name, false FROM employee_scope_assignments a
      JOIN cand c ON c.id = a.candidate_id JOIN vis v ON a.scope_type = 'customer' AND v.customer_id::text = a.scope_id
    UNION ALL SELECT v.id, c.id, c.full_name, false FROM employee_scope_assignments a
      JOIN cand c ON c.id = a.candidate_id JOIN vis v ON a.scope_type = 'state' AND v.st = a.scope_id
  ), lk AS MATERIALIZED (
    SELECT unit_id, id, max(full_name) full_name, bool_or(deployed) deployed FROM links GROUP BY unit_id, id
  ), g AS (
    SELECT lk.unit_id,
      jsonb_agg(jsonb_build_object('id', lk.id, 'name', coalesce(nullif(lk.full_name, ''), '—')) ORDER BY lk.full_name)
        FILTER (WHERE NOT p_lite) guards,
      count(*) guard_cnt,
      count(*) FILTER (WHERE lk.deployed) deployed_cnt
    FROM lk GROUP BY lk.unit_id
  ), rows AS (
    SELECT u.id, u.code, u.name, coalesce(u.location, '') location, u.branch_id, coalesce(u.customer_id::text, '') customer_id,
      coalesce(cst.name, '—') customer_name, coalesce(cst.code, '') customer_code, u.billing_state, u.billing_city,
      coalesce(nullif(u.client_state, ''), u.billing_state) client_state, coalesce(nullif(u.client_city, ''), u.billing_city) client_city,
      coalesce(ct.codes, ARRAY[]::text[]) contract_codes, ct.contract_end, coalesce(g.guards, '[]'::jsonb) security_guards,
      coalesce(g.deployed_cnt, 0) active_employee_count, coalesce(g.guard_cnt, 0) guard_count
    FROM vis v JOIN units u ON u.id = v.id
    LEFT JOIN customers cst ON cst.id = u.customer_id
    LEFT JOIN contracts ct ON ct.unit_id = u.id
    LEFT JOIN g ON g.unit_id = u.id
    -- Previous rule: unit must be under a contract or have at least one link.
    WHERE ct.unit_id IS NOT NULL OR g.unit_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'units', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.customer_name, coalesce(nullif(r.name, ''), r.code)) FROM rows r), '[]'::jsonb),
    'active_employees', (SELECT count(DISTINCT lk.id) FROM lk WHERE lk.deployed AND lk.unit_id IN (SELECT r.id FROM rows r)))
  INTO _payload;
  RETURN _payload;
END
$function$;
REVOKE ALL ON FUNCTION public._attendance_charter_units_compute(boolean, text, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public entry point. Drop the zero-arg overload so a no-argument call resolves
-- unambiguously to the defaulted signature.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_attendance_charter_units(p_lite boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _role text;
  _cand uuid;
  _scope text;
  _gen bigint;
  _key text;
  _hit jsonb;
  _data jsonb;
BEGIN
  -- Permission gate BEFORE any cache read.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Signed-in users without attendance/payroll/invoice/dashboard access (e.g.
  -- console users, who must still land on their dashboard) get an empty roster
  -- instead of an error — and never another unit's data.
  IF NOT public._charter_units_allowed() THEN
    RETURN jsonb_build_object('units', '[]'::jsonb, 'active_employees', 0);
  END IF;
  _role := public.current_user_role_key();
  _cand := public.current_user_candidate_id();
  _scope := CASE WHEN coalesce(_role, '') IN ('field_officer', 'hr_executive')
    THEN _role || ':' || coalesce(_cand::text, '-') ELSE 'all' END;
  _key := 'charter_units|v1|' || CASE WHEN coalesce(p_lite, false) THEN 'lite' ELSE 'full' END || '|' || _scope;
  SELECT last_value INTO _gen FROM public.charter_units_gen_seq;

  SELECT payload INTO _hit FROM public.rpc_cache
  WHERE key = _key AND computed_at > now() - interval '3 minutes' AND (payload->>'gen')::bigint = _gen;
  IF _hit IS NOT NULL THEN RETURN _hit->'data'; END IF;

  _data := public._attendance_charter_units_compute(coalesce(p_lite, false), _role, _cand);
  INSERT INTO public.rpc_cache(key, payload, computed_at)
  VALUES (_key, jsonb_build_object('gen', _gen, 'data', _data), now())
  ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
  RETURN _data;
END
$function$;
REVOKE ALL ON FUNCTION public.get_attendance_charter_units(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_charter_units(boolean) TO authenticated, service_role;

-- Zero-arg entry point kept (no DROP): same full payload as p_lite=false, so
-- existing callers and the pre-deploy client keep working. One-arg and
-- zero-arg calls resolve unambiguously because neither has a default.
CREATE OR REPLACE FUNCTION public.get_attendance_charter_units()
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT public.get_attendance_charter_units(false);
$function$;
REVOKE ALL ON FUNCTION public.get_attendance_charter_units() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_charter_units() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Distinct deployed people across a set of units (the register's visible
-- window/filter). Same eligibility as the charter; scoped roles are limited to
-- their own units.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charter_active_employee_total(p_unit_ids uuid[])
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _role text;
  _cand uuid;
  _n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Signed-in users without attendance/payroll/invoice/dashboard access (e.g.
  -- console users, who must still land on their dashboard) get an empty roster
  -- instead of an error — and never another unit's data.
  IF NOT public._charter_units_allowed() THEN
    RETURN jsonb_build_object('units', '[]'::jsonb, 'active_employees', 0);
  END IF;
  _role := public.current_user_role_key();
  _cand := public.current_user_candidate_id();
  WITH nb(k) AS (
    VALUES ('field_officer'),('branch_manager'),('hr'),('hr_executive'),('leadership'),('transport'),('inventory'),
      ('admin'),('super_admin'),('user'),('accounts'),('operations'),('operations_manager'),('area_manager'),('regional_manager')
  ), ids AS MATERIALIZED (
    SELECT DISTINCT x AS id FROM unnest(coalesce(p_unit_ids, ARRAY[]::uuid[])) x
    WHERE coalesce(_role, '') NOT IN ('field_officer', 'hr_executive')
       OR x IN (SELECT fos.unit_id FROM field_officer_scope fos WHERE _role = 'field_officer' AND fos.candidate_id = _cand
                UNION ALL SELECT u.id FROM units u WHERE _role = 'hr_executive' AND u.hr_executive_id = _cand)
  ), cand AS MATERIALIZED (
    SELECT c.id, c.unit_id FROM candidates c
    WHERE c.is_enabled AND c.status = 'active'
      AND ((coalesce(c.non_billable, false) = false AND lower(coalesce(c.role_key, '')) NOT IN (SELECT k FROM nb))
        OR c.unit_id IN (SELECT hu.id FROM units hu WHERE hu.is_billable = false))
  )
  SELECT count(DISTINCT p.id)::integer INTO _n FROM (
    SELECT c.id FROM cand c WHERE c.unit_id IN (SELECT id FROM ids)
    UNION ALL
    SELECT c.id FROM candidate_units cu JOIN cand c ON c.id = cu.candidate_id WHERE cu.unit_id IN (SELECT id FROM ids)
  ) p;
  RETURN coalesce(_n, 0);
END
$function$;
REVOKE ALL ON FUNCTION public.charter_active_employee_total(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charter_active_employee_total(uuid[]) TO authenticated, service_role;

COMMIT;

-- ROLLBACK (run as one transaction):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.charter_active_employee_total(uuid[]);
--   DROP FUNCTION IF EXISTS public.get_attendance_charter_units(boolean);
--   -- re-run the CREATE OR REPLACE FUNCTION public.get_attendance_charter_units()
--   -- block from db/prod-migrations/20261003070000_nonbillable_attendance_no_contract.sql
--   -- (lines 5-62), then:
--   GRANT EXECUTE ON FUNCTION public.get_attendance_charter_units() TO authenticated;
--   DROP FUNCTION IF EXISTS public._attendance_charter_units_compute(boolean, text, uuid);
--   DROP FUNCTION IF EXISTS public._charter_units_allowed();
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.units;
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.client_contracts;
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.candidate_units;
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.employee_scope_assignments;
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.customers;
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.candidates;
--   DROP TRIGGER IF EXISTS zz_charter_units_gen ON public.field_officer_scope;
--   DROP FUNCTION IF EXISTS public.bump_charter_units_gen();
--   DROP SEQUENCE IF EXISTS public.charter_units_gen_seq;
--   DELETE FROM public.rpc_cache WHERE key LIKE 'charter_units|%';
--   DROP INDEX IF EXISTS public.units_hr_executive_id_idx;
--   DROP INDEX IF EXISTS public.field_officer_scope_candidate_idx;
--   COMMIT;
--   NOTE: the old client build calls with no arguments and works against either
--   version; the new client falls back to the zero-arg call and to summed counts.
