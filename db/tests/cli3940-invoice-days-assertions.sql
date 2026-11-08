-- Read-only assertions, reusable inside the update transaction and on fresh readback.
DO $$
DECLARE saved public.backup_cli3940_invoice_units_20261108%ROWTYPE;
DECLARE current_contract jsonb;
BEGIN
  SELECT * INTO STRICT saved FROM public.backup_cli3940_invoice_units_20261108;
  SELECT to_jsonb(c) INTO STRICT current_contract FROM public.client_contracts c
  JOIN public.units u ON u.id=c.unit_id JOIN public.billing_types b ON b.id=c.billing_type_id
  WHERE u.code='CLI3940' AND c.id='7b2939a6-1b52-41ee-ba34-c73c3de9cf19' AND b.code='man_days';
  IF (current_contract - ARRAY['billing_type_id','updated_at']) IS DISTINCT FROM
    (saved.contract_before - ARRAY['billing_type_id','updated_at']) THEN
    RAISE EXCEPTION 'CLI3940 unrelated contract terms changed';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r
      WHERE r.contract_id='7b2939a6-1b52-41ee-ba34-c73c3de9cf19') IS DISTINCT FROM saved.resources_before THEN
    RAISE EXCEPTION 'CLI3940 rates, day bases or staffing changed';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attendance_entries a
      WHERE a.unit_id='8210da1f-d7de-4427-8d35-ce4aa2903488') IS DISTINCT FROM saved.attendance_before THEN
    RAISE EXCEPTION 'CLI3940 attendance changed';
  END IF;
END $$;