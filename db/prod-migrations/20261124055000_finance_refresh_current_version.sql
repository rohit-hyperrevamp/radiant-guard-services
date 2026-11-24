-- Version changes are work too: an old worker must not strand current v1 rows.
CREATE OR REPLACE FUNCTION public.claim_finance_totals(p_limit integer DEFAULT 60)
RETURNS SETOF public.finance_period_totals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN QUERY
 WITH picked AS (SELECT t.unit_id,t.period_start,t.period_end FROM public.finance_period_totals t
 JOIN public.units u ON u.id=t.unit_id LEFT JOIN public.customers c ON c.id=u.customer_id
 WHERE u.status='active' AND (u.customer_id IS NULL OR c.status='active')
 AND (t.calculated_generation IS DISTINCT FROM t.generation OR t.calculation_version<2)
 AND coalesce(t.lease_until,'-infinity')<now() AND coalesce(t.retry_after,'-infinity')<=now()
 ORDER BY t.period_end DESC LIMIT least(greatest(p_limit,1),100) FOR UPDATE OF t SKIP LOCKED)
 UPDATE public.finance_period_totals t SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 FROM picked p WHERE (t.unit_id,t.period_start,t.period_end)=(p.unit_id,p.period_start,p.period_end) RETURNING t.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_finance_totals(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_finance_totals(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.dispatch_finance_refresh() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg public.finance_refresh_config; BEGIN
 SELECT * INTO cfg FROM public.finance_refresh_config WHERE id FOR UPDATE;
 IF NOT cfg.enabled OR cfg.last_dispatched_at > now()-interval '10 seconds' THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_period_totals t
 JOIN public.units u ON u.id=t.unit_id LEFT JOIN public.customers c ON c.id=u.customer_id
 WHERE u.status='active' AND (u.customer_id IS NULL OR c.status='active')
 AND (t.calculated_generation IS DISTINCT FROM t.generation OR t.calculation_version<2)
 AND coalesce(t.lease_until,'-infinity')<now() AND coalesce(t.retry_after,'-infinity')<=now()) THEN RETURN; END IF;
 UPDATE public.finance_refresh_config SET last_dispatched_at=now() WHERE id;
 PERFORM net.http_post(url:='https://radiant.hyperrevamp.com/api/public/hooks/finance-refresh',
 headers:=jsonb_build_object('Content-Type','application/json','x-finance-key',cfg.hook_key),body:='{}'::jsonb,timeout_milliseconds:=120000);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_finance_refresh() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_finance_refresh() TO service_role;