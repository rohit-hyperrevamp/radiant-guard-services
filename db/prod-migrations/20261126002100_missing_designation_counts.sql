-- PERF: the "staff with a designation missing from the contract" tile made two
-- count-only calls to get_missing_contract_designations() (one with a
-- missing_since filter). PostgREST evaluates the whole function for each call
-- (2.2–2.5 s apiece). This returns {total, overdue} from ONE evaluation of the
-- unchanged base function, with a 5-minute rpc_cache entry.
--
-- Visibility: get_missing_contract_designations() (SECURITY DEFINER) filters by
-- viewer, not by gate: admins (is_admin_user()) and finance/accounts see every
-- row; field officers only staff they created / who report to them; everyone
-- else gets zero rows. The cache key therefore follows the same classes,
-- decided BEFORE any cache read:
--   * admin / finance / accounts -> one shared entry per cutoff ('all')
--   * field_officer              -> one entry per auth.uid()
--   * anyone else                -> {0,0} without computing or caching
-- Counts are computed by calling the base function itself, so the rule cannot
-- drift from the list the dialog shows.
--
-- Invalidation: the tile already refetches (debounced) on realtime changes to
-- candidate_units / contract_resources / client_contracts. Statement-level
-- triggers on the tables the base function reads bump a SEQUENCE whose value
-- is part of the cache key, so that refetch misses the old entry and sees
-- fresh numbers. A sequence (not DELETE FROM rpc_cache) on purpose: nextval is
-- non-transactional and takes no row lock, so a long import/attendance-rule
-- transaction can never make dashboard viewers wait on a locked cache row.
-- (A rolled-back write just costs one extra recompute.) The generic
-- public.rpc_cache_bump(sequence) trigger function is reused by
-- 20261126002200_document_followup_refresh.sql.
--
-- Requires public.rpc_cache (20261125001400_dashboard_rpc_cache.sql).
-- RISK: LOW. Without a write, tile counts can be up to 5 minutes old (the
-- client already caches them for 5 minutes). Client falls back to the old two calls on error.
-- VERIFY (as an admin JWT):
--   select public.missing_contract_designation_counts((current_date - 7));
--   -- equals:
--   select count(*), count(*) filter (where missing_since <= current_date - 7) from public.get_missing_contract_designations();
--   select key, computed_at from public.rpc_cache where key like 'missing_contract_designation_counts|%';

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.rpc_cache_gen_missing_designation;
REVOKE ALL ON SEQUENCE public.rpc_cache_gen_missing_designation FROM PUBLIC, anon, authenticated;

-- Generic statement-level trigger: advance the generation sequence named in
-- TG_ARGV[0]. SECURITY DEFINER because the sequences are revoked from app roles.
CREATE OR REPLACE FUNCTION public.rpc_cache_bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM nextval(TG_ARGV[0]::regclass);
  RETURN NULL;
END $function$;
REVOKE ALL ON FUNCTION public.rpc_cache_bump() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.missing_contract_designation_counts(p_cutoff date)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_class text;
  v_gen bigint;
  k text;
  hit jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  v_role := public.current_user_role_key();
  IF public.is_admin_user() OR v_role IN ('finance', 'accounts') THEN
    v_class := 'all';
  ELSIF v_role = 'field_officer' THEN
    v_class := 'fo:' || auth.uid()::text;
  ELSE
    -- The base function returns no rows for any other viewer.
    RETURN jsonb_build_object('total', 0, 'overdue', 0);
  END IF;

  SELECT last_value INTO v_gen FROM public.rpc_cache_gen_missing_designation;
  k := 'missing_contract_designation_counts|' || v_class || '|' || coalesce(p_cutoff::text, '') || '|g' || v_gen::text;
  SELECT payload INTO hit FROM public.rpc_cache WHERE key = k AND computed_at > now() - interval '5 minutes';
  IF hit IS NOT NULL THEN RETURN hit; END IF;

  SELECT jsonb_build_object(
           'total', count(*),
           'overdue', count(*) FILTER (WHERE p_cutoff IS NOT NULL AND m.missing_since <= p_cutoff))
    INTO hit
    FROM public.get_missing_contract_designations() m;

  INSERT INTO public.rpc_cache(key, payload, computed_at) VALUES (k, hit, now())
  ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
  -- Keep the table small: entries for old cutoffs / generations are never read again.
  DELETE FROM public.rpc_cache
   WHERE key LIKE 'missing_contract_designation_counts|%' AND key <> k AND computed_at < now() - interval '1 hour';
  RETURN hit;
END $function$;

REVOKE ALL ON FUNCTION public.missing_contract_designation_counts(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.missing_contract_designation_counts(date) TO authenticated, service_role;

DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_missing_designation' AND tgrelid='public.candidate_units'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_missing_designation
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_units
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_missing_designation')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_missing_designation' AND tgrelid='public.contract_resources'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_missing_designation
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_resources
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_missing_designation')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_missing_designation' AND tgrelid='public.client_contracts'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_missing_designation
  AFTER INSERT OR UPDATE OR DELETE ON public.client_contracts
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_missing_designation')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_missing_designation' AND tgrelid='public.units'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_missing_designation
  AFTER INSERT OR DELETE OR UPDATE OF is_billable ON public.units
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_missing_designation')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_missing_designation' AND tgrelid='public.candidates'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_missing_designation
  AFTER INSERT OR DELETE OR UPDATE OF status, is_enabled, created_by, reports_to ON public.candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_missing_designation')$q$;
END IF; END $t$;

COMMIT;

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS zz_rpc_cache_missing_designation ON public.candidate_units;   (and on
--     contract_resources, client_contracts, units, candidates)
--   DROP FUNCTION IF EXISTS public.missing_contract_designation_counts(date);
--   DELETE FROM public.rpc_cache WHERE key LIKE 'missing_contract_designation_counts|%';
--   DROP SEQUENCE IF EXISTS public.rpc_cache_gen_missing_designation;
--   (keep public.rpc_cache_bump() if 20261126002200 is applied)
