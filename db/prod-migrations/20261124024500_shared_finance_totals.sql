-- Exact results from the existing invoice/payroll engines. No SQL pricing estimates.
CREATE TABLE IF NOT EXISTS public.finance_period_totals (
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  period_start date NOT NULL, period_end date NOT NULL,
  generation bigint NOT NULL DEFAULT 1,
  calculated_generation bigint,
  calculation_version integer NOT NULL DEFAULT 1,
  totals jsonb,
  computed_at timestamptz,
  lease_token uuid, lease_until timestamptz,
  last_error text, retry_after timestamptz,
  PRIMARY KEY(unit_id,period_start,period_end),
  CHECK(period_end >= period_start AND period_end-period_start<=62)
);
REVOKE ALL ON public.finance_period_totals FROM anon,authenticated;
GRANT SELECT ON public.finance_period_totals TO authenticated;
GRANT INSERT(unit_id,period_start,period_end) ON public.finance_period_totals TO authenticated;
GRANT ALL ON public.finance_period_totals TO service_role;
ALTER TABLE public.finance_period_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_totals_read ON public.finance_period_totals FOR SELECT TO authenticated
USING ((SELECT public.current_user_module_access('invoice','view'))
  AND (SELECT public.current_user_module_access('payroll','view'))
  AND EXISTS(SELECT 1 FROM public.units u WHERE u.id=unit_id AND u.status='active'
    AND (u.customer_id IS NULL OR EXISTS(SELECT 1 FROM public.customers c WHERE c.id=u.customer_id AND c.status='active'))));
CREATE POLICY finance_totals_request ON public.finance_period_totals FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_user_module_access('invoice','view')) AND (SELECT public.current_user_module_access('payroll','view'))
 AND EXISTS(SELECT 1 FROM public.units u WHERE u.id=unit_id AND u.status='active'));
CREATE INDEX finance_totals_pending ON public.finance_period_totals(retry_after,period_end)
WHERE calculated_generation IS DISTINCT FROM generation;

CREATE TABLE IF NOT EXISTS public.finance_refresh_config (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  enabled boolean NOT NULL DEFAULT true,
  hook_key text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  last_dispatched_at timestamptz
);
REVOKE ALL ON public.finance_refresh_config FROM anon,authenticated;
GRANT ALL ON public.finance_refresh_config TO service_role;
ALTER TABLE public.finance_refresh_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.finance_refresh_config(id) VALUES(true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.dispatch_finance_refresh() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg public.finance_refresh_config; BEGIN
 SELECT * INTO cfg FROM public.finance_refresh_config WHERE id FOR UPDATE;
 IF NOT cfg.enabled OR cfg.last_dispatched_at > now()-interval '10 seconds' THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_period_totals WHERE calculated_generation IS DISTINCT FROM generation
   AND coalesce(lease_until,'-infinity')<now() AND coalesce(retry_after,'-infinity')<=now()) THEN RETURN; END IF;
 UPDATE public.finance_refresh_config SET last_dispatched_at=now() WHERE id;
 PERFORM net.http_post(url:='https://radiant.hyperrevamp.com/api/public/hooks/finance-refresh',
   headers:=jsonb_build_object('Content-Type','application/json','x-finance-key',cfg.hook_key),
   body:='{}'::jsonb,timeout_milliseconds:=120000);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_finance_refresh() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_finance_refresh() TO service_role;

CREATE OR REPLACE FUNCTION public.request_finance_totals(p_periods jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF jsonb_array_length(p_periods)>300 THEN RAISE EXCEPTION 'Too many periods'; END IF;
 IF NOT public.current_user_module_access('invoice','view') OR NOT public.current_user_module_access('payroll','view') THEN
   RAISE EXCEPTION 'Finance access required'; END IF;
 INSERT INTO public.finance_period_totals(unit_id,period_start,period_end)
 SELECT (p->>'u')::uuid,(p->>'s')::date,(p->>'e')::date
 FROM jsonb_array_elements(p_periods) p JOIN public.units u ON u.id=(p->>'u')::uuid
 WHERE u.status='active' AND ((p->>'e')::date-(p->>'s')::date) BETWEEN 0 AND 62
 ON CONFLICT DO NOTHING;
 PERFORM public.kick_finance_refresh();
END $$;

REVOKE ALL ON FUNCTION public.request_finance_totals(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_finance_totals(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.claim_finance_totals(p_limit integer DEFAULT 60)
RETURNS SETOF public.finance_period_totals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN QUERY
 WITH picked AS (SELECT unit_id,period_start,period_end FROM public.finance_period_totals
 WHERE calculated_generation IS DISTINCT FROM generation AND coalesce(lease_until,'-infinity')<now()
 AND coalesce(retry_after,'-infinity')<=now() ORDER BY period_end DESC LIMIT least(greatest(p_limit,1),100) FOR UPDATE SKIP LOCKED)
 UPDATE public.finance_period_totals t SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 FROM picked p WHERE (t.unit_id,t.period_start,t.period_end)=(p.unit_id,p.period_start,p.period_end) RETURNING t.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_finance_totals(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_finance_totals(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_finance_totals(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
 UPDATE public.finance_period_totals t SET totals=p->'totals',calculated_generation=t.generation,
 calculation_version=1,computed_at=now(),lease_token=NULL,lease_until=NULL,last_error=NULL,retry_after=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.generation=(p->>'generation')::bigint AND t.lease_token=(p->>'lease_token')::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
 -- A changed generation rejects the entire old result, then releases its lease for retry.
 UPDATE public.finance_period_totals t SET lease_token=NULL,lease_until=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.lease_token=(p->>'lease_token')::uuid;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.publish_finance_totals(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_finance_totals(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_finance_totals(p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.finance_period_totals t SET lease_token=NULL,lease_until=NULL,retry_after=now()+interval '1 hour',last_error='Source read or computation failed; no replacement totals published'
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid AND t.period_start=(p->>'period_start')::date
 AND t.period_end=(p->>'period_end')::date AND t.lease_token=(p->>'lease_token')::uuid;
END $$;
REVOKE ALL ON FUNCTION public.fail_finance_totals(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fail_finance_totals(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.continue_finance_refresh() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.finance_refresh_config SET last_dispatched_at=NULL WHERE id;
 PERFORM public.dispatch_finance_refresh();
END $$;
REVOKE ALL ON FUNCTION public.continue_finance_refresh() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.continue_finance_refresh() TO service_role;
CREATE OR REPLACE FUNCTION public.kick_finance_refresh() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.current_user_module_access('invoice','view') OR NOT public.current_user_module_access('payroll','view') THEN RAISE EXCEPTION 'Finance access required'; END IF;
 PERFORM public.dispatch_finance_refresh();
END $$;
REVOKE ALL ON FUNCTION public.kick_finance_refresh() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kick_finance_refresh() TO authenticated,service_role;

-- Statement-level invalidation: no attendance row streams, no pricing during writes.
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
 ELSIF TG_TABLE_NAME IN ('payroll_run_snapshots','pt_site_allocations') THEN
 -- Posting may change Professional Tax allocation at another site in the same month.
 UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL;
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
 ELSE UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL;
 END IF;
 PERFORM public.dispatch_finance_refresh(); RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.dirty_finance_totals() FROM PUBLIC,anon,authenticated;

DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['attendance_entries','attendance_sheets','payroll_runs','payroll_run_snapshots','final_invoice_units','final_invoices','invoice_extra_charges','candidates','candidate_units','employee_scope_assignments','employee_wages','additions','deductions','contract_resources','client_contracts','contract_rate_revisions','units','customers','allowance_types','cost_components','payroll_day_bases','billing_day_bases','attendance_codes','professional_tax_slabs','pincode_ranges','labour_welfare_funds','public_holidays','addition_types','pt_site_allocations'] LOOP
 IF to_regclass('public.'||tbl) IS NULL THEN CONTINUE; END IF;
 EXECUTE format('CREATE TRIGGER zz_finance_insert AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.dirty_finance_totals()',tbl);
 EXECUTE format('CREATE TRIGGER zz_finance_update AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.dirty_finance_totals()',tbl);
 EXECUTE format('CREATE TRIGGER zz_finance_delete AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.dirty_finance_totals()',tbl);
 END LOOP;
END $$;
-- Only money-related platform flags invalidate finance.
CREATE OR REPLACE FUNCTION public.dirty_finance_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF coalesce(NEW.key,OLD.key)='payroll_esi_round_up' THEN
 UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL;
 PERFORM public.dispatch_finance_refresh(); END IF; RETURN NULL; END $$;
CREATE TRIGGER zz_finance_settings AFTER INSERT OR UPDATE OR DELETE ON public.inv_settings FOR EACH ROW EXECUTE FUNCTION public.dirty_finance_settings();

CREATE OR REPLACE FUNCTION public.finance_totals_requested() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.dispatch_finance_refresh(); RETURN NULL; END $$;
CREATE TRIGGER finance_totals_requested AFTER INSERT ON public.finance_period_totals FOR EACH STATEMENT EXECUTE FUNCTION public.finance_totals_requested();

-- Register existing exact windows.
INSERT INTO public.finance_period_totals(unit_id,period_start,period_end)
SELECT unit_id,period_start,period_end FROM public.attendance_sheets
UNION SELECT unit_id,period_start,period_end FROM public.payroll_runs
UNION SELECT unit_id,period_start,period_end FROM public.final_invoice_units
ON CONFLICT DO NOTHING;
-- Hourly recovery only; normal updates are dispatched when source data changes.
SELECT public.dispatch_finance_refresh();
SELECT cron.schedule('finance-summary-recovery','0 * * * *','SELECT public.dispatch_finance_refresh()');