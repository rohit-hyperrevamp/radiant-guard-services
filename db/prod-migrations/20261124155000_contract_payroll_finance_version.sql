-- A contract-only payroll calculation must never be overwritten by an older worker.
CREATE OR REPLACE FUNCTION public.claim_finance_totals(p_limit integer DEFAULT 60)
RETURNS SETOF public.finance_period_totals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN QUERY
 WITH picked AS (SELECT t.unit_id,t.period_start,t.period_end FROM public.finance_period_totals t
 JOIN public.units u ON u.id=t.unit_id LEFT JOIN public.customers c ON c.id=u.customer_id
 WHERE u.status='active' AND (u.customer_id IS NULL OR c.status='active')
 AND (t.calculated_generation IS DISTINCT FROM t.generation OR t.calculation_version<3)
 AND coalesce(t.lease_until,'-infinity')<now() AND coalesce(t.retry_after,'-infinity')<=now()
 ORDER BY t.period_end DESC LIMIT least(greatest(p_limit,1),100) FOR UPDATE OF t SKIP LOCKED)
 UPDATE public.finance_period_totals t SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 FROM picked p WHERE (t.unit_id,t.period_start,t.period_end)=(p.unit_id,p.period_start,p.period_end) RETURNING t.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_finance_totals(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_finance_totals(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_finance_totals(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
 UPDATE public.finance_period_totals t SET totals=p->'totals',calculated_generation=t.generation,
 calculation_version=(p->>'calculation_version')::integer,computed_at=now(),
 lease_token=NULL,lease_until=NULL,last_error=NULL,retry_after=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.generation=(p->>'generation')::bigint AND t.lease_token=(p->>'lease_token')::uuid
 AND (p->>'calculation_version')::integer>=3
 AND jsonb_typeof(p->'totals'->'employer_cost')='number'
 AND jsonb_typeof(p->'totals'->'billing_addons')='number';
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.finance_period_totals t SET lease_token=NULL,lease_until=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.lease_token=(p->>'lease_token')::uuid;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.publish_finance_totals(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_finance_totals(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.dispatch_finance_refresh()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cfg public.finance_refresh_config; BEGIN
 SELECT * INTO cfg FROM public.finance_refresh_config WHERE id FOR UPDATE;
 IF NOT cfg.enabled OR cfg.last_dispatched_at > now()-interval '10 seconds' THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_period_totals t
 JOIN public.units u ON u.id=t.unit_id LEFT JOIN public.customers c ON c.id=u.customer_id
 WHERE u.status='active' AND (u.customer_id IS NULL OR c.status='active')
 AND (t.calculated_generation IS DISTINCT FROM t.generation OR t.calculation_version<3)
 AND coalesce(t.lease_until,'-infinity')<now() AND coalesce(t.retry_after,'-infinity')<=now()) THEN RETURN; END IF;
 UPDATE public.finance_refresh_config SET last_dispatched_at=now() WHERE id;
 PERFORM net.http_post(url:='https://radiant.hyperrevamp.com/api/public/hooks/finance-refresh',
 headers:=jsonb_build_object('Content-Type','application/json','x-finance-key',cfg.hook_key),body:='{}'::jsonb,timeout_milliseconds:=120000);
END $function$
;
REVOKE ALL ON FUNCTION public.dispatch_finance_refresh() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_finance_refresh() TO service_role;
