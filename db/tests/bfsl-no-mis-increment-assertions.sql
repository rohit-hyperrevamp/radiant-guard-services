DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invoice_extra_charges e
    JOIN public.units u ON u.id=e.unit_id
    JOIN public.customers c ON c.id=u.customer_id
    WHERE c.id='589e6827-8569-4f42-8da5-cc3b870e679e'
      AND e.enabled AND e.description ~* '(increment|[bp]fsl.*mis|supplement)'
  ) THEN RAISE EXCEPTION 'Bajaj Securities unauthorized MIS charges must be disabled across all periods'; END IF;
  IF (SELECT count(*) FROM public.backup_bfsl_mis_increment_20261108) <> 6 THEN
    RAISE EXCEPTION 'Expected six backed-up remaining MIS increment charges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.backup_bfsl_mis_increment_20261108 b
    LEFT JOIN public.invoice_extra_charges e ON e.id=b.id
    WHERE e.id IS NULL OR e.enabled OR
      (to_jsonb(e)-'enabled'-'updated_at') IS DISTINCT FROM
      (to_jsonb(b)-'enabled'-'updated_at')
  ) THEN RAISE EXCEPTION 'Only enabled state and update timestamp may change'; END IF;
END $$;