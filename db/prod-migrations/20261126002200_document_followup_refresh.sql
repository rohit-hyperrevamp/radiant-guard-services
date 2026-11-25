-- PERF: keep the dashboard "document follow-up" summary warm and correct.
--
-- 20261125001400 cached document_followup_summary() for 10 minutes, but the
-- first viewer after expiry still waited ~3.6 s, and uploads did not
-- invalidate it. This migration:
--   1. Splits document_followup_pending_for(uuid) into the permission gate
--      (unchanged; still the public function, same signature and grants) and
--      an UNGATED internal body _document_followup_pending_rows(uuid). The body
--      is copied verbatim from db/offboarding-resignation-collection.sql (the
--      latest definition). One body, so the cron path and the user path can
--      never compute different numbers.
--   2. _document_followup_pending_all(): the document_followup_pending()
--      aggregation over the ungated rows (internal; public
--      document_followup_pending() is untouched and stays gated).
--   3. document_followup_summary_refresh(): computes the pending list ONCE and
--      upserts the cache rows for the parameter sets the app uses (status
--      active / all / inactive with no date range: DocumentFollowupPanel's
--      defaults; the dashboard uses 'active'). Internal: no user gate,
--      REVOKEd from PUBLIC/anon/authenticated; pg_cron calls it every 5 min.
--   4. Invalidation by generation: statement-level triggers on every table that
--      feeds the pending list (employee_document_receipts,
--      employee_document_policies, employee_signed_documents, rec_candidates,
--      rec_candidate_documents, rehire_requests and the relevant candidates
--      columns) advance sequence rpc_cache_gen_document_followup, whose value
--      is part of the cache key. A sequence instead of DELETE FROM rpc_cache so
--      long import transactions never hold row locks that dashboard viewers or
--      the cron would wait on. After an upload the next viewer recomputes (or
--      the next cron run re-warms within 5 minutes).
--   5. document_followup_summary(text, date, date): same signature and result;
--      the permission gate is still checked BEFORE the cache read; the key now
--      ends in '|g<generation>'.
--
-- Requires 20261125001400 (rpc_cache, _document_followup_summary_compute) and
-- 20261126002100 (public.rpc_cache_bump()).
--
-- PRE-APPLY CHECK (the live body must equal the repo copy this migration
-- re-installs; if it differs, update _document_followup_pending_rows first):
--   select pg_get_functiondef('public.document_followup_pending_for(uuid)'::regprocedure);
--   -- compare with db/offboarding-resignation-collection.sql
-- RISK: LOW-MEDIUM. Counts identical by construction; the cron adds ~2-3 s of
-- DB work every 5 minutes. Rollback at the end.
-- VERIFY:
--   select public.document_followup_summary_refresh();   -- as postgres: returns 3
--   select key, computed_at from public.rpc_cache where key like 'document_followup_summary|%' order by computed_at desc;
--   select jobname, schedule from cron.job where jobname = 'document-followup-summary-refresh';
--   -- as a recruitment user (dashboard): document_followup_summary('active', null, null) returns in a few ms
--   -- and equals _document_followup_summary_compute('active', null, null) (run as postgres with a JWT, or compare to the old value)
--   -- insert/update an employee_document_receipts row -> last_value of rpc_cache_gen_document_followup increases.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.rpc_cache_gen_document_followup;
REVOKE ALL ON SEQUENCE public.rpc_cache_gen_document_followup FROM PUBLIC, anon, authenticated;

-- 1. Ungated internal body (verbatim copy, gate line removed).
CREATE OR REPLACE FUNCTION public._document_followup_pending_rows(p_candidate uuid)
 RETURNS TABLE(id uuid, rec_id uuid, full_name text, code text, purpose text, start_date text, missing text[], missing_details text[], due date, overdue boolean, active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with pol as (select p.purpose, p.required_keys, p.required_details, p.deadline_days from employee_document_policies p),
  today as (select (now() at time zone 'Asia/Kolkata')::date d),
  emp as (select * from public.document_followup_employees() e where p_candidate is null or e.id=p_candidate),
  rec_link as (
    select distinct on (r.employee_candidate_id) r.employee_candidate_id, r.id, r.onboarded_at
    from rec_candidates r where r.employee_candidate_id is not null order by r.employee_candidate_id, r.created_at desc),
  rec_ev as (
    select x.rid, array_agg(x.k) ks from (
      select rc.rec_candidate_id rid, rc.document_key k from employee_document_receipts rc where rc.rec_candidate_id is not null
      union all
      select d.candidate_id, case d.category when '10th_certificate' then 'tenth' when '12th_certificate' then 'twelfth'
        when 'graduation_certificate' then 'graduation' when 'salary_slip' then 'salary_slip' when 'resignation_letter' then 'resignation'
        when 'relieving_letter' then 'relieving' when 'experience_letter' then 'experience' end
      from rec_candidate_documents d where d.file_path is not null and d.file_path<>''
    ) x where x.k is not null group by x.rid),
  emp_ev as (select rc.candidate_id cid, array_agg(rc.document_key) || case when bool_or(rc.document_key='signed_resignation') then array['resignation'] else '{}'::text[] end ks from employee_document_receipts rc where rc.candidate_id is not null group by rc.candidate_id),
  emp_det as (
    select c.id cid, array_remove(array[
      case when coalesce(c.aadhaar_number,'')<>'' then 'aadhaar_number' end,
      case when coalesce(c.pan_number,'')<>'' then 'pan_number' end,
      case when coalesce(c.bank_account_number,'')<>'' then 'bank_account' end,
      case when coalesce(c.bank_ifsc,'')<>'' then 'bank_ifsc' end,
      case when coalesce(c.bank_name,'')<>'' then 'bank_name' end,
      case when c.date_of_birth is not null then 'date_of_birth' end,
      case when coalesce(c.mobile,'')<>'' then 'mobile' end,
      case when coalesce(c.present_address1,'')<>'' then 'present_address' end,
      case when coalesce(c.permanent_address1,'')<>'' then 'permanent_address' end,
      case when coalesce(c.emergency_contact_mobile,'')<>'' then 'emergency_contact' end,
      case when coalesce(c.offboarding_details->>'date_of_last_working','')<>'' then 'last_working_date' end,
      case when coalesce(c.offboarding_details->>'reason_text','')<>'' then 'exit_reason' end
    ]::text[], null) ks
    from candidates c where c.id in (select e.id from emp e)),
  rh as (
    select distinct on (pid) pid, r.status, r.new_candidate_id, r.previous_candidate_id, r.created_at, r.resignation_url, r.id_card_url
    from rehire_requests r, lateral (values (r.previous_candidate_id),(r.new_candidate_id)) v(pid)
    where pid is not null order by pid, r.created_at desc),
  people as (
    select e.id, rl.id rec_id, e.full_name, e.code, 'onboarding'::text purpose, coalesce(e.start_date, rl.onboarded_at::text) st,
      coalesce(e.evidence,'{}') || coalesce(ee.ks,'{}') || coalesce(re.ks,'{}') ev, coalesce(dt.ks,'{}') det, e.active act
    from emp e left join rec_link rl on rl.employee_candidate_id=e.id left join emp_ev ee on ee.cid=e.id left join rec_ev re on re.rid=rl.id left join emp_det dt on dt.cid=e.id
    where e.active
    union all
    select e.id, null, e.full_name, e.code, 'offboarding', e.exit_date,
      coalesce(e.evidence,'{}') || coalesce(ee.ks,'{}') || coalesce(re.ks,'{}'), coalesce(dt.ks,'{}'), e.active
    from emp e left join rec_link rl on rl.employee_candidate_id=e.id left join emp_ev ee on ee.cid=e.id left join rec_ev re on re.rid=rl.id left join emp_det dt on dt.cid=e.id
    where e.exit_pending
    union all
    select e.id, null, e.full_name, e.code, 'rehire', h.created_at::text,
      coalesce(e.evidence,'{}') || coalesce(ee.ks,'{}') || coalesce(re.ks,'{}')
        || case when coalesce(h.resignation_url,'')<>'' then array['resignation'] else '{}'::text[] end
        || case when coalesce(h.id_card_url,'')<>'' then array['id_card'] else '{}'::text[] end, coalesce(dt.ks,'{}'), e.active
    from emp e join rh h on h.pid=e.id left join rec_link rl on rl.employee_candidate_id=e.id left join emp_ev ee on ee.cid=e.id left join rec_ev re on re.rid=rl.id left join emp_det dt on dt.cid=e.id
    where coalesce(h.status,'') not in ('rejected','cancelled') and e.id = coalesce(h.new_candidate_id, h.previous_candidate_id)
    union all
    select r.id, r.id, r.full_name, coalesce(r.code,''), 'onboarding', nullif(r.offer->>'joining_date',''), coalesce(re.ks,'{}'),
      case when coalesce(r.mobile,'')<>'' then array['mobile'] else '{}'::text[] end, true
    from rec_candidates r left join rec_ev re on re.rid=r.id
    where p_candidate is null and r.employee_candidate_id is null and coalesce(r.stage,'') not in ('rejected','withdrawn')
  ),
  scored as (
    select p.*, array(select k from unnest(pol.required_keys) k where not (k = any(p.ev))) miss,
      array(select k from unnest(pol.required_details) k where not (k = any(p.det))
        and (p.rec_id is distinct from p.id or k='mobile')) mdet,
      case when p.st ~ '^\d{4}-\d{2}-\d{2}' then left(p.st,10)::date + pol.deadline_days end dd
    from people p join pol on pol.purpose=p.purpose
  )
  select s.id, s.rec_id, s.full_name, s.code, s.purpose, s.st, s.miss, s.mdet, s.dd, (s.dd is not null and s.dd < (select d from today)), s.act
  from scored s where cardinality(s.miss) > 0 or cardinality(s.mdet) > 0;
  return query
  select c.id, null::uuid, c.full_name, coalesce(c.employee_code,c.candidate_code,''),
    case when d.rendered_body::jsonb->>'kind' in ('resignation','termination','experience','relieving') then 'offboarding' else 'onboarding' end,
    d.issued_at::text, array['signed_'||(d.rendered_body::jsonb->>'kind')], '{}'::text[],
    (d.issued_at at time zone 'Asia/Kolkata')::date + coalesce(pol.deadline_days,10),
    (d.issued_at at time zone 'Asia/Kolkata')::date + coalesce(pol.deadline_days,10) < (now() at time zone 'Asia/Kolkata')::date,
    c.status is distinct from 'inactive' and c.is_enabled is distinct from false
  from employee_signed_documents d join candidates c on c.id=d.candidate_id
  left join employee_document_policies pol on pol.purpose=case when d.rendered_body::jsonb->>'kind' in ('resignation','termination','experience','relieving') then 'offboarding' else 'onboarding' end
  where d.issued_at is not null and (p_candidate is null or c.id=p_candidate)
    and not exists(select 1 from employee_document_receipts r where r.letter_copy_id=d.id and r.candidate_id=c.id);
end $function$;
REVOKE ALL ON FUNCTION public._document_followup_pending_rows(uuid) FROM PUBLIC, anon, authenticated;

-- Public function: identical gate, then the shared body.
CREATE OR REPLACE FUNCTION public.document_followup_pending_for(p_candidate uuid)
 RETURNS TABLE(id uuid, rec_id uuid, full_name text, code text, purpose text, start_date text, missing text[], missing_details text[], due date, overdue boolean, active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or not (public.current_user_can_recruit() or (p_candidate is not null and p_candidate=public.current_user_candidate_id())) then raise exception 'Not allowed' using errcode='42501'; end if;
  return query select * from public._document_followup_pending_rows(p_candidate);
end $function$;
REVOKE ALL ON FUNCTION public.document_followup_pending_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_followup_pending_for(uuid) TO authenticated;

-- 2. Internal, ungated twin of document_followup_pending() (same aggregation).
CREATE OR REPLACE FUNCTION public._document_followup_pending_all()
RETURNS TABLE(id uuid,rec_id uuid,full_name text,code text,purpose text,start_date text,missing text[],missing_details text[],due date,overdue boolean,active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH p AS MATERIALIZED (select * from public._document_followup_pending_rows(null)),
 files AS (select id,purpose,array_agg(distinct k order by k) ks from p,unnest(missing) k group by id,purpose),
 details AS (select id,purpose,array_agg(distinct k order by k) ks from p,unnest(missing_details) k group by id,purpose)
 select p.id,p.rec_id,p.full_name,p.code,p.purpose,min(p.start_date),
 coalesce(f.ks,'{}'),coalesce(d.ks,'{}'),min(p.due),bool_or(p.overdue),bool_or(p.active)
 from p left join files f on f.id=p.id and f.purpose=p.purpose left join details d on d.id=p.id and d.purpose=p.purpose
 group by p.id,p.rec_id,p.full_name,p.code,p.purpose,f.ks,d.ks;
$$;
REVOKE ALL ON FUNCTION public._document_followup_pending_all() FROM PUBLIC, anon, authenticated;

-- 3. Cron refresh: one pending computation, three cached summaries. Payload
-- expressions are _document_followup_summary_compute's with p_from = p_to =
-- null (so `dated` = every pending row and `p` = dated filtered by status).
CREATE OR REPLACE FUNCTION public.document_followup_summary_refresh()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gen bigint;
  n integer;
BEGIN
  -- Read the generation BEFORE computing: a write during the computation bumps
  -- it, so these rows are simply never read and the next call recomputes.
  SELECT last_value INTO v_gen FROM public.rpc_cache_gen_document_followup;
  WITH dated AS MATERIALIZED (SELECT * FROM public._document_followup_pending_all()),
  st(s) AS (VALUES ('active'::text), ('all'), ('inactive')),
  p AS MATERIALIZED (
    SELECT st.s, x.* FROM st JOIN dated x
      ON (st.s = 'all' OR (st.s = 'exits' AND x.purpose = 'offboarding') OR (st.s IN ('active', 'inactive') AND (st.s = 'active') = x.active))
  ),
  payloads AS (
    SELECT 'document_followup_summary|' || st.s || '|||g' || v_gen::text AS k,
      jsonb_build_object(
        'exits', (SELECT count(DISTINCT id) FROM dated WHERE purpose = 'offboarding'),
        'exit_overdue', (SELECT count(*) FROM dated WHERE purpose = 'offboarding' AND overdue),
        'people', (SELECT count(DISTINCT coalesce(p.rec_id, p.id)) FROM p WHERE p.s = st.s),
        'overdue', (SELECT count(*) FROM p WHERE p.s = st.s AND p.overdue),
        'types', coalesce((SELECT jsonb_object_agg(t.k, t.n) FROM (SELECT k, count(*) n FROM p, unnest(p.missing) k WHERE p.s = st.s GROUP BY k) t), '{}'::jsonb),
        'details', coalesce((SELECT jsonb_object_agg(t.k, t.n) FROM (SELECT k, count(*) n FROM p, unnest(p.missing_details) k WHERE p.s = st.s GROUP BY k) t), '{}'::jsonb)
      ) AS payload
    FROM st
  )
  INSERT INTO public.rpc_cache(key, payload, computed_at)
  SELECT k, payload, now() FROM payloads
  ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Drop stale generations, old date ranges and pre-generation keys.
  DELETE FROM public.rpc_cache WHERE key LIKE 'document_followup_summary|%' AND computed_at < now() - interval '1 hour';
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.document_followup_summary_refresh() FROM PUBLIC, anon, authenticated;

-- 5. Public entry point: same signature and result; gate before cache.
CREATE OR REPLACE FUNCTION public.document_followup_summary(p_status text, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_gen bigint;
  k text;
  hit jsonb;
BEGIN
  -- Same permission gate as document_followup_pending_for, checked BEFORE the
  -- cache so a user without Recruitment access never receives cached counts.
  IF auth.uid() IS NULL OR NOT public.current_user_can_recruit() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT last_value INTO v_gen FROM public.rpc_cache_gen_document_followup;
  k := 'document_followup_summary|' || coalesce(p_status, '') || '|' || coalesce(p_from::text, '') || '|' || coalesce(p_to::text, '') || '|g' || v_gen::text;
  SELECT payload INTO hit FROM public.rpc_cache WHERE key = k AND computed_at > now() - interval '10 minutes';
  IF hit IS NOT NULL THEN RETURN hit; END IF;
  hit := public._document_followup_summary_compute(p_status, p_from, p_to);
  INSERT INTO public.rpc_cache(key, payload, computed_at) VALUES (k, hit, now())
  ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
  RETURN hit;
END $function$;
REVOKE ALL ON FUNCTION public.document_followup_summary(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_followup_summary(text, date, date) TO authenticated, service_role;

-- 4. Invalidation triggers (statement level, sequence bump only).
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.employee_document_receipts'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR UPDATE OR DELETE ON public.employee_document_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.employee_document_policies'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR UPDATE OR DELETE ON public.employee_document_policies
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.employee_signed_documents'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR UPDATE OR DELETE ON public.employee_signed_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.rec_candidates'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR UPDATE OR DELETE ON public.rec_candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.rec_candidate_documents'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR UPDATE OR DELETE ON public.rec_candidate_documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.rehire_requests'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR UPDATE OR DELETE ON public.rehire_requests
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;
-- candidates: only the columns the pending list reads for COUNTS (names and
-- codes change list text, not the summary), so photo-thumb regeneration and
-- other unrelated writes do not invalidate it.
DO $t$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='zz_rpc_cache_document_followup' AND tgrelid='public.candidates'::regclass) THEN
  EXECUTE $q$CREATE TRIGGER zz_rpc_cache_document_followup AFTER INSERT OR DELETE OR UPDATE OF
    status, is_enabled, preferred_joining_date, offboarding_details, offboarded_at,
    photo_url, aadhaar_image_url, aadhaar_back_image_url, pan_image_url, signature_url, other_info, documents,
    aadhaar_number, pan_number, bank_account_number, bank_ifsc, bank_name, date_of_birth, mobile,
    present_address1, permanent_address1, emergency_contact_mobile
  ON public.candidates
  FOR EACH STATEMENT EXECUTE FUNCTION public.rpc_cache_bump('public.rpc_cache_gen_document_followup')$q$;
END IF; END $t$;

-- pg_cron: re-warm every 5 minutes (idempotent: drop any same-named job first).
DO $do$
DECLARE _job bigint;
BEGIN
  FOR _job IN SELECT jobid FROM cron.job WHERE jobname = 'document-followup-summary-refresh' LOOP
    PERFORM cron.unschedule(_job);
  END LOOP;
  PERFORM cron.schedule('document-followup-summary-refresh', '*/5 * * * *', 'select public.document_followup_summary_refresh()');
END $do$;

COMMIT;

-- Warm immediately (outside the transaction so a failure here cannot undo the migration):
SELECT public.document_followup_summary_refresh();

-- ROLLBACK:
--   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'document-followup-summary-refresh';
--   DROP TRIGGER IF EXISTS zz_rpc_cache_document_followup ON public.employee_document_receipts;  (and on
--     employee_document_policies, employee_signed_documents, rec_candidates, rec_candidate_documents,
--     rehire_requests, candidates)
--   Re-apply document_followup_summary from 20261125001400 (key without '|g...').
--   Re-apply document_followup_pending_for from db/offboarding-resignation-collection.sql, then
--   DROP FUNCTION public.document_followup_summary_refresh(), public._document_followup_pending_all(),
--     public._document_followup_pending_rows(uuid); DROP SEQUENCE public.rpc_cache_gen_document_followup;
