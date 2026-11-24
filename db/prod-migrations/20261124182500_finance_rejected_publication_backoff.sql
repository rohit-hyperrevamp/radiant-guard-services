-- Keep version-4 calculation and the existing privilege boundary; rejected old
-- workers must not continually reclaim the same records during Git delivery.
CREATE OR REPLACE FUNCTION public.publish_finance_totals(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer; BEGIN
 UPDATE public.finance_period_totals t SET totals=p->'totals',calculated_generation=t.generation,
 calculation_version=(p->>'calculation_version')::integer,computed_at=now(),
 lease_token=NULL,lease_until=NULL,last_error=NULL,retry_after=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.generation=(p->>'generation')::bigint AND t.lease_token=(p->>'lease_token')::uuid
 AND (p->>'calculation_version')::integer>=4
 AND jsonb_typeof(p->'totals'->'employer_cost')='number'
 AND jsonb_typeof(p->'totals'->'billing_addons')='number';
 GET DIAGNOSTICS n=ROW_COUNT;
 -- Successfully published rows already released their lease. Only rejected
 -- rows are left here. Changed generations can retry immediately; same-source
 -- version/schema failures wait without replacing any saved money amounts.
 UPDATE public.finance_period_totals t SET lease_token=NULL,lease_until=NULL,
 retry_after=CASE WHEN t.generation=(p->>'generation')::bigint THEN now()+interval '1 hour' ELSE t.retry_after END,
 last_error=CASE WHEN t.generation=(p->>'generation')::bigint
   THEN CASE WHEN coalesce((p->>'calculation_version')::integer,0)<4
     THEN 'Dashboard update awaiting the current application version; outdated totals rejected'
     ELSE 'Finance summary is incomplete; saved amounts have not been replaced' END
   ELSE t.last_error END
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.lease_token=(p->>'lease_token')::uuid;
 RETURN n;
END $function$;