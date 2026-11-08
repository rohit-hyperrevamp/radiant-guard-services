-- Read-only assertions, reusable inside the update transaction and on fresh readback.
DO $$
DECLARE saved public.backup_cli4189_invoice_units_20261108%ROWTYPE;
DECLARE current_contract jsonb;
BEGIN
  SELECT * INTO STRICT saved FROM public.backup_cli4189_invoice_units_20261108;
  SELECT to_jsonb(c) INTO STRICT current_contract FROM public.client_contracts c
  JOIN public.units u ON u.id=c.unit_id JOIN public.billing_types b ON b.id=c.billing_type_id
  WHERE u.code='CLI4189' AND c.id='11154c66-4e46-4e4c-9ea0-ac67a6950e12' AND b.code='man_days';
  IF (current_contract - ARRAY['billing_type_id','updated_at']) IS DISTINCT FROM
    (saved.contract_before - ARRAY['billing_type_id','updated_at']) THEN
    RAISE EXCEPTION 'CLI4189 unrelated contract terms changed';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r
      WHERE r.contract_id='11154c66-4e46-4e4c-9ea0-ac67a6950e12') IS DISTINCT FROM saved.resources_before THEN
    RAISE EXCEPTION 'CLI4189 rates, day bases or staffing changed';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attendance_entries a
      WHERE a.unit_id='253fd48f-0c30-4102-b69c-4e99e812b196') IS DISTINCT FROM saved.attendance_before THEN
    RAISE EXCEPTION 'CLI4189 attendance changed';
  END IF;
END $$;