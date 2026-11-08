DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invoice_extra_charges e
    JOIN public.units u ON u.id=e.unit_id
    WHERE e.id='6694299d-edcb-4053-9f67-5af869e0fc13'
      AND u.code='CLI2991' AND NOT e.enabled
      AND e.description='Increment / OT as per BFSL MIS Sep-2026'
      AND e.quantity=1 AND e.rate=439.01
      AND e.period_start='2026-08-21' AND e.period_end='2026-09-20'
  ) THEN RAISE EXCEPTION 'CLI2991 unauthorized MIS increment must be disabled'; END IF;
  IF (SELECT count(*) FROM public.backup_cli2991_mis_increment_20261108) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one backed-up CLI2991 charge';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.backup_cli2991_mis_increment_20261108 b
    LEFT JOIN public.invoice_extra_charges e ON e.id=b.id
    WHERE e.id IS NULL OR e.enabled OR
      (to_jsonb(e)-'enabled'-'updated_at') IS DISTINCT FROM
      (to_jsonb(b)-'enabled'-'updated_at')
  ) THEN RAISE EXCEPTION 'Only enabled state and update timestamp may change'; END IF;
END $$;