-- PERF: cache the dashboard "document follow-up" summary for 10 minutes.
-- document_followup_summary(p_status, p_from, p_to) took ~1.8–5.6 s per call
-- (it rebuilds the pending-documents list across all employees) and runs on
-- every dashboard load. The data is company-wide for every permitted viewer
-- (document_followup_pending_for(null) only GATES on current_user_can_recruit;
-- it doesn't filter by viewer), so one shared cached copy per parameter set is
-- safe — provided the wrapper repeats the gate before reading the cache.
-- APPLIED LIVE 25 Nov 2026 (measured: 2,418 ms → 2 ms on a cache hit).
--
-- Also adds the composite indexes created live on 25 Nov 2026 so the repo
-- matches the database.
-- RISK: LOW. Counts can be up to 10 minutes old on the dashboard card.
-- VERIFY: call twice; the second call returns in a few ms.

BEGIN;

CREATE INDEX IF NOT EXISTS contract_resources_contract_designation_idx ON public.contract_resources (contract_id, designation_id);
CREATE INDEX IF NOT EXISTS contract_rate_revisions_status_contract_idx ON public.contract_rate_revisions (status, contract_id);
CREATE INDEX IF NOT EXISTS candidate_units_designation_unit_idx ON public.candidate_units (designation_id, unit_id);

CREATE TABLE IF NOT EXISTS public.rpc_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rpc_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rpc_cache FROM PUBLIC, anon, authenticated;

-- The original calculation, unchanged, under a private name.
CREATE OR REPLACE FUNCTION public._document_followup_summary_compute(p_status text, p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
with dated as materialized (select * from public.document_followup_pending() x where (p_from is null or left(x.start_date,10) >= p_from::text) and (p_to is null or left(x.start_date,10) <= p_to::text)),
p as (select * from dated x where (coalesce(p_status,'all')='all' or (p_status='exits' and x.purpose='offboarding') or (p_status in ('active','inactive') and (p_status='active') = x.active)) and (p_from is null or left(x.start_date,10) >= p_from::text) and (p_to is null or left(x.start_date,10) <= p_to::text))
select jsonb_build_object(
 'exits', (select count(distinct id) from dated where purpose='offboarding'),
 'exit_overdue', (select count(*) from dated where purpose='offboarding' and overdue),
 'people', (select count(distinct coalesce(rec_id,id)) from p),
 'overdue', (select count(*) from p where overdue),
 'types', coalesce((select jsonb_object_agg(k,n) from (select k,count(*) n from p, unnest(p.missing) k group by k) t),'{}'::jsonb),
 'details', coalesce((select jsonb_object_agg(k,n) from (select k,count(*) n from p, unnest(p.missing_details) k group by k) t),'{}'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public._document_followup_summary_compute(text, date, date) FROM PUBLIC, anon, authenticated;

-- Public entry point: same signature and result, served from a 10-minute cache.
CREATE OR REPLACE FUNCTION public.document_followup_summary(p_status text, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  k text := 'document_followup_summary|' || coalesce(p_status, '') || '|' || coalesce(p_from::text, '') || '|' || coalesce(p_to::text, '');
  hit jsonb;
BEGIN
  -- Same permission gate as document_followup_pending_for, checked BEFORE the
  -- cache so a user without Recruitment access never receives cached counts.
  IF auth.uid() IS NULL OR NOT public.current_user_can_recruit() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT payload INTO hit FROM public.rpc_cache WHERE key = k AND computed_at > now() - interval '10 minutes';
  IF hit IS NOT NULL THEN RETURN hit; END IF;
  hit := public._document_followup_summary_compute(p_status, p_from, p_to);
  INSERT INTO public.rpc_cache(key, payload, computed_at) VALUES (k, hit, now())
  ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
  RETURN hit;
END $function$;
REVOKE ALL ON FUNCTION public.document_followup_summary(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_followup_summary(text, date, date) TO authenticated, service_role;

COMMIT;

-- ROLLBACK: restore the uncached function body (identical to
-- _document_followup_summary_compute, LANGUAGE sql STABLE) as
-- document_followup_summary(text, date, date), then
-- DROP FUNCTION public._document_followup_summary_compute(text, date, date);
-- DROP TABLE public.rpc_cache;
