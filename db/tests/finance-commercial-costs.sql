BEGIN;
DO $$
DECLARE r public.finance_period_totals; token uuid:=gen_random_uuid(); published integer;
BEGIN
 SELECT * INTO r FROM public.finance_period_totals ORDER BY period_end DESC LIMIT 1;
 IF r.unit_id IS NULL THEN RAISE EXCEPTION 'No period available for rollback verification'; END IF;
 UPDATE public.finance_period_totals SET generation=generation+1,lease_token=token,lease_until=now()+interval '5 minutes'
 WHERE unit_id=r.unit_id AND period_start=r.period_start AND period_end=r.period_end;
 published:=public.publish_finance_totals(jsonb_build_array(jsonb_build_object(
 'unit_id',r.unit_id,'period_start',r.period_start,'period_end',r.period_end,'generation',r.generation+1,
 'lease_token',token,'calculation_version',2,'totals',jsonb_build_object(
 'invoice_amount',25000,'payroll_cost',18000,'employer_contribution',4800,'employer_cost',1800,'billing_addons',3000))));
 IF published<>1 THEN RAISE EXCEPTION 'Version 2 total not published'; END IF;
 SELECT * INTO r FROM public.finance_period_totals WHERE unit_id=r.unit_id AND period_start=r.period_start AND period_end=r.period_end;
 IF r.calculation_version<>2 OR (r.totals->>'employer_cost')::numeric<>1800
 OR (r.totals->>'invoice_amount')::numeric-(r.totals->>'payroll_cost')::numeric-(r.totals->>'employer_cost')::numeric<>5200
 THEN RAISE EXCEPTION 'Commercial fees incorrectly enter employer costs or profit'; END IF;
 IF has_function_privilege('authenticated','public.publish_finance_totals(jsonb)','EXECUTE')
 OR has_table_privilege('authenticated','public.finance_period_totals','UPDATE') THEN
 RAISE EXCEPTION 'Browser can overwrite authoritative money'; END IF;
END $$;
ROLLBACK;