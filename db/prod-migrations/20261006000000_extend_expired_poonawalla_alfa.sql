-- Extend expired Poonawalla / Alfa Laval contracts to 1 Dec 2026; leave running ones untouched.
UPDATE public.client_contracts cc
SET end_date = '2026-12-01',
    expiry_date = CASE WHEN cc.expiry_date IS NOT NULL THEN '2026-12-01'::date ELSE NULL END
FROM public.units u
WHERE u.id = cc.unit_id
  AND u.customer_id IN ('786f0e76-0e85-4ef4-a4ca-6d282814c1db','04f3c69b-ea28-45cd-8631-7228c71f56cf')
  AND coalesce(cc.end_date, cc.expiry_date) < current_date;
