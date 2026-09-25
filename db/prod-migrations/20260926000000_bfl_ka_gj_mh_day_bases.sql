-- Bajaj Finance (Karnataka, Gujarat, Maharashtra; Telangana excluded):
-- payroll = Days Minus Four, billing = Actual Days in Month.
UPDATE public.contract_resources r
SET payroll_day_base_id = (SELECT id FROM public.payroll_day_bases WHERE code='DAYS_MINUS_4'),
    billing_day_base_id = (SELECT id FROM public.billing_day_bases WHERE code='ACTUAL_DAYS'),
    updated_at = now()
FROM public.client_contracts c JOIN public.units u ON u.id=c.unit_id JOIN public.customers cu ON cu.id=u.customer_id
WHERE c.id=r.contract_id AND c.status='active' AND cu.name ILIKE 'Bajaj Financ%'
  AND lower(trim(coalesce(nullif(u.client_state,''),u.billing_state))) IN ('karnataka','gujarat','maharashtra');
