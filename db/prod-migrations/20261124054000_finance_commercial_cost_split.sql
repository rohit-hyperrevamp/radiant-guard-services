-- Keep original payroll totals; v2 records actual employer cost separately.
-- Old workers remain version 1 and cannot publish a misleading v2 result.
CREATE OR REPLACE FUNCTION public.publish_finance_totals(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
 UPDATE public.finance_period_totals t SET totals=p->'totals',calculated_generation=t.generation,
 calculation_version=coalesce((p->>'calculation_version')::integer,1),computed_at=now(),
 lease_token=NULL,lease_until=NULL,last_error=NULL,retry_after=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.generation=(p->>'generation')::bigint AND t.lease_token=(p->>'lease_token')::uuid
 AND (coalesce((p->>'calculation_version')::integer,1)<2 OR
   (jsonb_typeof(p->'totals'->'employer_cost')='number' AND jsonb_typeof(p->'totals'->'billing_addons')='number'));
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.finance_period_totals t SET lease_token=NULL,lease_until=NULL
 FROM jsonb_array_elements(p_rows) p WHERE t.unit_id=(p->>'unit_id')::uuid
 AND t.period_start=(p->>'period_start')::date AND t.period_end=(p->>'period_end')::date
 AND t.lease_token=(p->>'lease_token')::uuid;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.publish_finance_totals(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_finance_totals(jsonb) TO service_role;
UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL
WHERE calculation_version<2 AND calculated_generation=generation;