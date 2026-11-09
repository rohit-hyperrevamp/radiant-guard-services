DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.units WHERE code='CLI3431' AND status='active') THEN
    RAISE EXCEPTION 'CLI3431 must remain active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_contracts c JOIN public.units u ON u.id=c.unit_id
    JOIN public.billing_types b ON b.id=c.billing_type_id
    WHERE u.code='CLI3431' AND c.status='active' AND b.code='man_days') THEN
    RAISE EXCEPTION 'CLI3431 main invoice must bill days';
  END IF;
END $$;