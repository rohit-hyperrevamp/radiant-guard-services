-- Live saved-data regression for the user's billing-only L&T Gujarat rule.
BEGIN READ ONLY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contract_resources r
    JOIN public.client_contracts c ON c.id = r.contract_id JOIN public.units u ON u.id = c.unit_id
    WHERE u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353' AND lower(trim(u.client_state)) = 'gujarat') THEN
    RAISE EXCEPTION 'Missing Gujarat L&T test records';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contract_resources r
    JOIN public.client_contracts c ON c.id = r.contract_id JOIN public.units u ON u.id = c.unit_id
    LEFT JOIN public.billing_day_bases b ON b.id = r.billing_day_base_id
    WHERE u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353' AND lower(trim(u.client_state)) = 'gujarat'
      AND (b.code IS DISTINCT FROM 'DAYS_MINUS_4' OR b.method IS DISTINCT FROM 'actual_minus_days'
        OR b.fixed_days IS DISTINCT FROM 4)) THEN
    RAISE EXCEPTION 'L&T Gujarat billing must use Days Minus Four';
  END IF;
END $$;
ROLLBACK;