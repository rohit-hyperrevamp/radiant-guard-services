-- CLI4189: invoice duties use days; preserve rates, attendance and other terms.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT id FROM public.client_contracts
WHERE id = '11154c66-4e46-4e4c-9ea0-ac67a6950e12' FOR UPDATE;

CREATE TABLE public.backup_cli4189_invoice_units_20261108 AS
SELECT to_jsonb(c) AS contract_before,
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r WHERE r.contract_id=c.id) AS resources_before,
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attendance_entries a WHERE a.unit_id=c.unit_id) AS attendance_before
FROM public.client_contracts c WHERE c.id='11154c66-4e46-4e4c-9ea0-ac67a6950e12';
GRANT ALL ON public.backup_cli4189_invoice_units_20261108 TO service_role;
ALTER TABLE public.backup_cli4189_invoice_units_20261108 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE changed integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.client_contracts c JOIN public.units u ON u.id=c.unit_id
    JOIN public.billing_types b ON b.id=c.billing_type_id
    WHERE c.id='11154c66-4e46-4e4c-9ea0-ac67a6950e12' AND u.code='CLI4189'
      AND c.status='active' AND b.code='man_hours') THEN
    RAISE EXCEPTION 'Expected CLI4189 active contract with Man Hours billing';
  END IF;
  IF (SELECT count(*) FROM public.billing_types WHERE code='man_days' AND enabled) <> 1 THEN
    RAISE EXCEPTION 'Expected one enabled Man Days billing type';
  END IF;
  UPDATE public.client_contracts SET billing_type_id=(SELECT id FROM public.billing_types WHERE code='man_days' AND enabled)
  WHERE id='11154c66-4e46-4e4c-9ea0-ac67a6950e12';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Expected exactly one contract update'; END IF;
END $$;
-- Assert both the requested units and preservation before committing.
\ir ../tests/cli4189-invoice-days-assertions.sql
COMMIT;