-- Production-only, backed-up September approval and finance publication.
-- Supply review_file as a CSV generated from the current shared source engines.
-- Default execution rolls back; -v apply_changes=1 commits after every assertion.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '15s';

CREATE TEMP TABLE september_review (
  unit_id uuid, period_start date, period_end date,
  expected_generation bigint, blocking_count integer, payable_rows integer,
  expected_run jsonb, expected_sheet jsonb, totals jsonb,
  PRIMARY KEY (unit_id, period_start, period_end)
);
\i :review_file

-- Lock source-status and publication rows before deciding eligibility.
SELECT count(*) FROM (SELECT t.unit_id FROM public.finance_period_totals t
  JOIN september_review r USING (unit_id, period_start, period_end)
  ORDER BY t.unit_id, t.period_start, t.period_end FOR UPDATE OF t) locked;
SELECT count(*) FROM (SELECT p.id FROM public.payroll_runs p
  JOIN september_review r USING (unit_id, period_start, period_end)
  ORDER BY p.id FOR UPDATE OF p) locked;
SELECT count(*) FROM (SELECT a.id FROM public.attendance_sheets a
  JOIN september_review r USING (unit_id, period_start, period_end)
  ORDER BY a.id FOR UPDATE OF a) locked;

CREATE TEMP TABLE september_runs_before AS SELECT * FROM public.payroll_runs;
CREATE TEMP TABLE september_sheets_before AS SELECT * FROM public.attendance_sheets;
CREATE TEMP TABLE september_source_fingerprints AS
SELECT 'attendance' AS source, md5(coalesce(string_agg(md5(to_jsonb(e)::text), '' ORDER BY e.id), '')) AS fingerprint
  FROM public.attendance_entries e
UNION ALL SELECT 'rates', md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY r.id), '')) FROM public.contract_resources r
UNION ALL SELECT 'revisions', md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY r.id), '')) FROM public.contract_rate_revisions r
UNION ALL SELECT 'snapshots', md5(coalesce(string_agg(md5(to_jsonb(s)::text), '' ORDER BY s.id), '')) FROM public.payroll_run_snapshots s
UNION ALL SELECT 'invoices', md5(coalesce(string_agg(md5(to_jsonb(i)::text), '' ORDER BY i.id), '')) FROM public.final_invoices i;

CREATE TEMP TABLE september_fresh_review AS
SELECT r.* FROM september_review r
JOIN public.finance_period_totals t USING (unit_id, period_start, period_end)
JOIN public.units u ON u.id = r.unit_id
LEFT JOIN public.customers c ON c.id = u.customer_id
WHERE r.period_end >= DATE '2026-09-01' AND r.period_end < DATE '2026-10-01'
  AND u.status = 'active' AND (u.customer_id IS NULL OR c.status = 'active')
  AND t.generation = r.expected_generation;

CREATE TEMP TABLE september_approval_batch AS
SELECT p.id AS payroll_id, a.id AS attendance_id, r.unit_id, r.period_start, r.period_end
FROM september_fresh_review r
JOIN public.payroll_runs p USING (unit_id, period_start, period_end)
JOIN public.attendance_sheets a USING (unit_id, period_start, period_end)
WHERE r.blocking_count = 0 AND r.payable_rows > 0 AND r.totals IS NOT NULL
  AND p.status IN ('draft', 'submitted') AND p.payroll_status = 'open'
  AND a.status IN ('draft', 'submitted', 'approved')
  AND coalesce(a.amendment_status, 'none') NOT IN ('open', 'submitted')
  AND to_jsonb(p) = r.expected_run AND to_jsonb(a) = r.expected_sheet;

UPDATE public.attendance_sheets a SET status = 'submitted', submitted_at = coalesce(a.submitted_at, now())
FROM september_approval_batch b WHERE a.id = b.attendance_id AND a.status = 'draft';
UPDATE public.attendance_sheets a SET status = 'approved', approved_at = coalesce(a.approved_at, now())
FROM september_approval_batch b WHERE a.id = b.attendance_id AND a.status = 'submitted';
UPDATE public.payroll_runs p SET status = 'submitted', submitted_at = coalesce(p.submitted_at, now())
FROM september_approval_batch b WHERE p.id = b.payroll_id AND p.status = 'draft';
UPDATE public.payroll_runs p SET status = 'approved', approved_at = coalesce(p.approved_at, now()),
  submitted_at = coalesce(p.submitted_at, now())
FROM september_approval_batch b WHERE p.id = b.payroll_id AND p.status = 'submitted'
  AND EXISTS (SELECT 1 FROM public.attendance_sheets a WHERE a.id = b.attendance_id AND a.status = 'approved');

-- Preserve database audit changes while making the automated request explicit.
UPDATE public.system_logs l SET actor_name = 'Assistant (requested by Rohit Joshi)',
  details = l.details || jsonb_build_object('requested_by', 'Rohit Joshi', 'operation', 'September verified contract-only payroll approvals')
WHERE l.created_at >= transaction_timestamp() AND l.user_id IS NULL AND l.source = 'database'
  AND ((l.entity_type = 'payroll_runs' AND l.entity_id IN (SELECT payroll_id::text FROM september_approval_batch))
    OR (l.entity_type = 'attendance_sheets' AND l.entity_id IN (SELECT attendance_id::text FROM september_approval_batch)));

-- Approval changes invalidate the generation, not the underlying source maths.
-- Publish the reviewed engine totals using the new generation and a private lease.
UPDATE public.finance_period_totals t SET lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes'
FROM september_fresh_review r WHERE (t.unit_id, t.period_start, t.period_end) = (r.unit_id, r.period_start, r.period_end)
  AND r.blocking_count = 0 AND r.totals IS NOT NULL;
SELECT public.publish_finance_totals(coalesce(jsonb_agg(jsonb_build_object(
  'unit_id', t.unit_id, 'period_start', t.period_start, 'period_end', t.period_end,
  'generation', t.generation, 'lease_token', t.lease_token, 'calculation_version', 4, 'totals', r.totals)), '[]'::jsonb)) AS refreshed
FROM public.finance_period_totals t JOIN september_fresh_review r USING (unit_id, period_start, period_end)
WHERE r.blocking_count = 0 AND r.totals IS NOT NULL;

UPDATE public.finance_period_totals t SET calculated_generation = NULL, lease_token = NULL, lease_until = NULL,
  retry_after = now() + interval '1 hour', last_error = CASE WHEN r.blocking_count > 0
    THEN 'September contract-only payroll source exceptions require review; no replacement totals published'
    ELSE 'September invoice source is unavailable; no replacement totals published' END
FROM september_fresh_review r WHERE (t.unit_id, t.period_start, t.period_end) = (r.unit_id, r.period_start, r.period_end)
  AND (r.blocking_count > 0 OR r.totals IS NULL);

DO $$
DECLARE before_hash record; after_hash text; approved_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM september_approval_batch b JOIN public.payroll_runs p ON p.id = b.payroll_id
    JOIN public.attendance_sheets a ON a.id = b.attendance_id
    WHERE p.status <> 'approved' OR a.status <> 'approved' OR p.submitted_at IS NULL OR p.approved_at IS NULL)
    THEN RAISE EXCEPTION 'Every eligible payroll must be submitted and approved after attendance approval'; END IF;
  IF EXISTS (SELECT 1 FROM september_approval_batch b JOIN september_review r USING (unit_id, period_start, period_end)
    WHERE r.blocking_count > 0) THEN RAISE EXCEPTION 'Unresolved source exceptions must never be approved'; END IF;
  IF EXISTS (SELECT 1 FROM september_runs_before old JOIN public.payroll_runs p USING (id)
    WHERE NOT EXISTS (SELECT 1 FROM september_approval_batch b WHERE b.payroll_id = p.id) AND to_jsonb(old) <> to_jsonb(p))
    THEN RAISE EXCEPTION 'Pre-existing approvals, processed payroll and outside-scope records must stay unchanged'; END IF;
  IF EXISTS (SELECT 1 FROM september_runs_before old JOIN public.payroll_runs p USING (id)
    WHERE (to_jsonb(old) - ARRAY['status','submitted_at','approved_at','updated_at'])
      <> (to_jsonb(p) - ARRAY['status','submitted_at','approved_at','updated_at']))
    THEN RAISE EXCEPTION 'Payroll processing fields, actors and amounts must not be changed'; END IF;
  IF EXISTS (SELECT 1 FROM september_sheets_before old JOIN public.attendance_sheets a USING (id)
    WHERE NOT EXISTS (SELECT 1 FROM september_approval_batch b WHERE b.attendance_id = a.id) AND to_jsonb(old) <> to_jsonb(a))
    THEN RAISE EXCEPTION 'Unrelated or blocked attendance approvals must stay unchanged'; END IF;
  IF EXISTS (SELECT 1 FROM september_fresh_review r JOIN public.finance_period_totals t USING (unit_id, period_start, period_end)
    WHERE r.blocking_count = 0 AND r.totals IS NOT NULL AND
      (t.totals IS DISTINCT FROM r.totals OR t.calculation_version <> 4 OR t.calculated_generation IS DISTINCT FROM t.generation))
    THEN RAISE EXCEPTION 'Refreshed totals must read back exactly as the source-engine calculation'; END IF;
  IF EXISTS (SELECT 1 FROM september_fresh_review r JOIN public.finance_period_totals t USING (unit_id, period_start, period_end)
    WHERE (r.blocking_count > 0 OR r.totals IS NULL) AND t.calculated_generation = t.generation)
    THEN RAISE EXCEPTION 'Unavailable or unresolved amounts must not be presented as current'; END IF;
  FOR before_hash IN SELECT * FROM september_source_fingerprints LOOP
    IF before_hash.source = 'attendance' THEN SELECT md5(coalesce(string_agg(md5(to_jsonb(e)::text), '' ORDER BY e.id), '')) INTO after_hash FROM public.attendance_entries e;
    ELSIF before_hash.source = 'rates' THEN SELECT md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY r.id), '')) INTO after_hash FROM public.contract_resources r;
    ELSIF before_hash.source = 'revisions' THEN SELECT md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY r.id), '')) INTO after_hash FROM public.contract_rate_revisions r;
    ELSIF before_hash.source = 'snapshots' THEN SELECT md5(coalesce(string_agg(md5(to_jsonb(s)::text), '' ORDER BY s.id), '')) INTO after_hash FROM public.payroll_run_snapshots s;
    ELSE SELECT md5(coalesce(string_agg(md5(to_jsonb(i)::text), '' ORDER BY i.id), '')) INTO after_hash FROM public.final_invoices i; END IF;
    IF before_hash.fingerprint IS DISTINCT FROM after_hash THEN RAISE EXCEPTION 'Source preservation failed: %', before_hash.source; END IF;
  END LOOP;
  SELECT count(*) INTO approved_count FROM september_approval_batch;
  RAISE NOTICE 'Verified % newly approved September payrolls; unresolved exceptions and all money sources preserved', approved_count;
END $$;

INSERT INTO public.system_logs (module, action, entity_type, entity_id, entity_label, actor_name, source, status, details)
SELECT 'Payroll', 'approve', 'payroll_runs', 'september-2026-contract-only', 'September verified approvals and dashboard refresh',
  'Assistant (requested by Rohit Joshi)', 'assistant', 'success', jsonb_build_object(
    'approved_payrolls', (SELECT count(*) FROM september_approval_batch),
    'refreshed_windows', (SELECT count(*) FROM september_fresh_review WHERE blocking_count = 0 AND totals IS NOT NULL),
    'source_review_windows', (SELECT count(*) FROM september_fresh_review WHERE blocking_count > 0),
    'calculation_version', 4, 'processed_payroll_preserved', true, 'contract_rates_preserved', true);

SELECT (SELECT count(*) FROM september_approval_batch) AS newly_approved_payrolls,
  (SELECT count(*) FROM september_approval_batch b JOIN september_sheets_before a ON a.id = b.attendance_id WHERE a.status <> 'approved') AS newly_approved_attendance,
  (SELECT count(*) FROM september_fresh_review WHERE blocking_count = 0 AND totals IS NOT NULL) AS refreshed_windows,
  (SELECT count(*) FROM september_fresh_review WHERE blocking_count > 0) AS source_review_windows,
  (SELECT count(*) FROM september_fresh_review WHERE blocking_count = 0 AND totals IS NULL) AS unavailable_invoice_windows,
  (SELECT count(*) FROM september_review) - (SELECT count(*) FROM september_fresh_review) AS changed_source_windows;

\if :{?apply_changes}
COMMIT;
\else
ROLLBACK;
\endif