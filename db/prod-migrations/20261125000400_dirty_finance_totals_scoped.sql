-- 20261125000400_dirty_finance_totals_scoped.sql
-- RISK: LOW - apply now.
--
-- CLOSES: L23 root cause + L14 class of bug. public.dirty_finance_totals()
--   (statement trigger zz_finance_* on ~29 tables) had two UPDATEs with NO WHERE
--   on finance_period_totals:
--     (a) the catch-all ELSE (hit by customers -> "UPDATE requires a WHERE clause",
--         21000, org creation broken; live hot-fix dropped the customers triggers), and
--     (b) the payroll_run_snapshots / pt_site_allocations branch, which bumped the
--         generation of ALL ~8,785 finance rows on every payroll posting, so
--         in-flight finance computations were rejected as dirty
--         ("Source read or computation failed", 216 Oct / 50 Nov sites).
--   With safe-update active live, (a) and (b) also make every write to those
--   tables FAIL (payroll posting inserts snapshots; PT slab / LWF / allowance
--   master edits hit the ELSE). See README "Important finding".
--
-- CHANGES (everything else byte-identical to db/prod-migrations/20261124024500_shared_finance_totals.sql):
--   * payroll_run_snapshots: bump only windows overlapping the posted run's
--     period (payroll_runs.period_start/period_end via payroll_run_id), at every
--     site (PT moves between sites in the same month). If the run row is gone
--     (cascade delete) fall back to the snapshot's own unit.
--   * pt_site_allocations: bump only windows whose period_end month equals the
--     row's period_year/period_month.
--   * Known global money masters that previously fell into ELSE
--     (final_invoices, contract_rate_revisions, allowance_types, cost_components,
--     payroll_day_bases, billing_day_bases, attendance_codes, professional_tax_slabs,
--     pincode_ranges, labour_welfare_funds, public_holidays, addition_types) keep
--     the full invalidation they always intended, now with an explicit WHERE true.
--   * ELSE (any other table, e.g. customers): RETURN NULL - no update, no dispatch.
--   NOT changed: dirty_finance_settings() (inv_settings 'payroll_esi_round_up')
--   still has a no-WHERE UPDATE - flagged in README as a follow-up.
--
-- AFFECTED SCREENS / ROLES: Payroll Process, all Control Center money masters,
--   Organizations create/edit, dashboard finance tiles (fewer spurious "Pending").
--
-- VERIFY AFTER APPLYING:
--   SELECT pg_get_functiondef('public.dirty_finance_totals()'::regprocedure) LIKE '%RETURN NULL;%END IF;%';
--   -- Dry run in a transaction that is rolled back (pick a real processed run id):
--   BEGIN;
--   CREATE TEMP TABLE g0 AS SELECT unit_id, period_start, period_end, generation FROM public.finance_period_totals;
--   UPDATE public.payroll_run_snapshots SET updated_at = updated_at WHERE payroll_run_id = '<run id>';
--   SELECT count(*) FROM public.finance_period_totals t JOIN g0 USING (unit_id, period_start, period_end)
--    WHERE t.generation <> g0.generation;   -- only windows overlapping that run's period, not ~8,785
--   ROLLBACK;
--   -- Create an organisation in the UI (customers) -> succeeds even if zz_finance_* triggers exist on customers.
--   Next day: SELECT date_trunc('month',period_end), count(*) FILTER (WHERE last_error IS NOT NULL)
--             FROM public.finance_period_totals GROUP BY 1 ORDER BY 1 DESC;   -- failures fall

BEGIN;

CREATE OR REPLACE FUNCTION public.dirty_finance_totals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected jsonb; BEGIN
 IF TG_OP='INSERT' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO affected FROM new_rows r;
 ELSIF TG_OP='DELETE' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO affected FROM old_rows r;
 ELSE SELECT coalesce(jsonb_agg(j),'[]') INTO affected FROM (SELECT to_jsonb(r) j FROM new_rows r UNION SELECT to_jsonb(r) FROM old_rows r) x; END IF;
 IF affected='[]'::jsonb THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='candidates' THEN
 IF NOT EXISTS(SELECT 1 FROM new_rows n JOIN old_rows o ON n.id=o.id WHERE
 (to_jsonb(n)-ARRAY['updated_at','last_seen_at','last_location_at','latitude','longitude','photo_url','photo_thumb_url']) IS DISTINCT FROM
 (to_jsonb(o)-ARRAY['updated_at','last_seen_at','last_location_at','latitude','longitude','photo_url','photo_thumb_url'])) THEN RETURN NULL; END IF;
 END IF;
 IF TG_TABLE_NAME='attendance_entries' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
 AND (r->>'entry_date')::date BETWEEN t.period_start AND t.period_end);
 ELSIF TG_TABLE_NAME IN ('attendance_sheets','payroll_runs','final_invoice_units','invoice_extra_charges') THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
 AND ((r->>'period_end') IS NULL OR (r->>'period_end')::date=t.period_end));
 ELSIF TG_TABLE_NAME='payroll_run_snapshots' THEN
 -- Posting may change Professional Tax allocation at another site in the same month:
 -- bump only finance windows overlapping the posted run's period (any site), not the whole table.
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r
 LEFT JOIN public.payroll_runs pr ON pr.id=(r->>'payroll_run_id')::uuid
 WHERE (pr.id IS NOT NULL AND t.period_start<=pr.period_end AND t.period_end>=pr.period_start)
 OR (pr.id IS NULL AND (r->>'unit_id')::uuid=t.unit_id));
 ELSIF TG_TABLE_NAME='pt_site_allocations' THEN
 -- Pages PT split is per person/site/month: bump windows whose period_end falls in that month.
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r
 WHERE (r->>'period_year') IS NOT NULL AND (r->>'period_month') IS NOT NULL
 AND date_trunc('month',t.period_end)::date=make_date((r->>'period_year')::int,(r->>'period_month')::int,1));
 ELSIF TG_TABLE_NAME IN ('candidates','candidate_units','employee_wages','employee_scope_assignments','additions','deductions') THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
 OR EXISTS(SELECT 1 FROM public.attendance_entries a WHERE a.unit_id=t.unit_id
 AND a.entry_date BETWEEN t.period_start AND t.period_end
 AND a.candidate_id=coalesce((r->>'candidate_id')::uuid,CASE WHEN TG_TABLE_NAME='candidates' THEN (r->>'id')::uuid END)));
 ELSIF TG_TABLE_NAME='contract_resources' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE t.unit_id IN (SELECT c.unit_id FROM public.client_contracts c JOIN jsonb_array_elements(affected) r ON c.id=(r->>'contract_id')::uuid);
 ELSIF TG_TABLE_NAME IN ('units','client_contracts') THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE t.unit_id=CASE WHEN TG_TABLE_NAME='units' THEN (r->>'id')::uuid ELSE (r->>'unit_id')::uuid END);
 ELSIF TG_TABLE_NAME IN ('final_invoices','contract_rate_revisions','allowance_types','cost_components','payroll_day_bases','billing_day_bases','attendance_codes','professional_tax_slabs','pincode_ranges','labour_welfare_funds','public_holidays','addition_types') THEN
 -- Global money masters: every window may change. Explicit WHERE keeps safe-update guards happy.
 UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL WHERE true;
 ELSE
 -- Unknown table (e.g. customers): nothing to invalidate.
 RETURN NULL;
 END IF;
 PERFORM public.dispatch_finance_refresh(); RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.dirty_finance_totals() FROM PUBLIC,anon,authenticated;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually) - exact prior definition from
-- db/prod-migrations/20261124024500_shared_finance_totals.sql (lines 128-168).
-- WARNING: restores the no-WHERE updates.
-- ======================================================================
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.dirty_finance_totals() RETURNS trigger
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
-- DECLARE affected jsonb; BEGIN
--  IF TG_OP='INSERT' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO affected FROM new_rows r;
--  ELSIF TG_OP='DELETE' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO affected FROM old_rows r;
--  ELSE SELECT coalesce(jsonb_agg(j),'[]') INTO affected FROM (SELECT to_jsonb(r) j FROM new_rows r UNION SELECT to_jsonb(r) FROM old_rows r) x; END IF;
--  IF affected='[]'::jsonb THEN RETURN NULL; END IF;
--  IF TG_OP='UPDATE' AND TG_TABLE_NAME='candidates' THEN
--  IF NOT EXISTS(SELECT 1 FROM new_rows n JOIN old_rows o ON n.id=o.id WHERE
--  (to_jsonb(n)-ARRAY['updated_at','last_seen_at','last_location_at','latitude','longitude','photo_url','photo_thumb_url']) IS DISTINCT FROM
--  (to_jsonb(o)-ARRAY['updated_at','last_seen_at','last_location_at','latitude','longitude','photo_url','photo_thumb_url'])) THEN RETURN NULL; END IF;
--  END IF;
--  IF TG_TABLE_NAME='attendance_entries' THEN
--  UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
--  WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
--  AND (r->>'entry_date')::date BETWEEN t.period_start AND t.period_end);
--  ELSIF TG_TABLE_NAME IN ('attendance_sheets','payroll_runs','final_invoice_units','invoice_extra_charges') THEN
--  UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
--  WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
--  AND ((r->>'period_end') IS NULL OR (r->>'period_end')::date=t.period_end));
--  ELSIF TG_TABLE_NAME IN ('payroll_run_snapshots','pt_site_allocations') THEN
--  -- Posting may change Professional Tax allocation at another site in the same month.
--  UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL;
--  ELSIF TG_TABLE_NAME IN ('candidates','candidate_units','employee_wages','employee_scope_assignments','additions','deductions') THEN
--  UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
--  WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
--  OR EXISTS(SELECT 1 FROM public.attendance_entries a WHERE a.unit_id=t.unit_id
--  AND a.entry_date BETWEEN t.period_start AND t.period_end
--  AND a.candidate_id=coalesce((r->>'candidate_id')::uuid,CASE WHEN TG_TABLE_NAME='candidates' THEN (r->>'id')::uuid END)));
--  ELSIF TG_TABLE_NAME='contract_resources' THEN
--  UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
--  WHERE t.unit_id IN (SELECT c.unit_id FROM public.client_contracts c JOIN jsonb_array_elements(affected) r ON c.id=(r->>'contract_id')::uuid);
--  ELSIF TG_TABLE_NAME IN ('units','client_contracts') THEN
--  UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
--  WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE t.unit_id=CASE WHEN TG_TABLE_NAME='units' THEN (r->>'id')::uuid ELSE (r->>'unit_id')::uuid END);
--  ELSE UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL;
--  END IF;
--  PERFORM public.dispatch_finance_refresh(); RETURN NULL;
-- END $$;
-- REVOKE ALL ON FUNCTION public.dirty_finance_totals() FROM PUBLIC,anon,authenticated;
-- COMMIT;
