DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoice_extra_charges
    WHERE enabled AND description ILIKE '%extra duty supplement%') THEN
    RAISE EXCEPTION 'Unauthorized Extra Duty supplements remain enabled';
  END IF;
  IF (SELECT count(*) FROM public.backup_ed_supplements_20261108) <> 15 THEN
    RAISE EXCEPTION 'Expected backup of 15 removed supplements';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.backup_ed_supplements_20261108 b
    JOIN public.invoice_extra_charges e ON e.id=b.id
    JOIN public.units u ON u.id=e.unit_id
    WHERE u.code='CLI2535' AND b.rate=398.53 AND b.quantity=1 AND NOT e.enabled) THEN
    RAISE EXCEPTION 'CLI2535 unwanted third charge must be disabled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.backup_ed_supplements_20261108 b
    LEFT JOIN public.invoice_extra_charges e ON e.id=b.id
    WHERE e.id IS NULL OR e.enabled OR
      (to_jsonb(e)-'enabled'-'updated_at') IS DISTINCT FROM
      (to_jsonb(b)-'enabled'-'updated_at')) THEN
    RAISE EXCEPTION 'Only supplement enabled state may change';
  END IF;
END $$;