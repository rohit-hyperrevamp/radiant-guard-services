-- CLI3871 only: interpret saved WO as P through the existing contract flag.
-- Keep expired contracts, source attendance and posted money records unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE cli3871_contracts_before ON COMMIT DROP AS
SELECT * FROM public.client_contracts;
CREATE TEMP TABLE cli3871_entries_before ON COMMIT DROP AS
SELECT e.* FROM public.attendance_entries e
WHERE e.unit_id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8';
CREATE TEMP TABLE cli3871_resources_before ON COMMIT DROP AS
SELECT r.* FROM public.contract_resources r
JOIN public.client_contracts c ON c.id = r.contract_id
WHERE c.unit_id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.units
      WHERE code = 'CLI3871' AND id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8') <> 1 THEN
    RAISE EXCEPTION 'CLI3871 identity differs from the verified client';
  END IF;
  IF (SELECT count(*) FROM public.client_contracts
      WHERE unit_id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8' AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Expected one active CLI3871 contract';
  END IF;
END $$;

UPDATE public.client_contracts
SET wo_as_present = true
WHERE id = 'a19ae14f-74b3-4d96-9689-d617edcbbb5c'
  AND unit_id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8'
  AND status = 'active'
  AND wo_as_present IS DISTINCT FROM true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_contracts c JOIN public.units u ON u.id = c.unit_id
    WHERE u.code = 'CLI3871' AND c.contract_code = 'CON14307'
      AND c.status = 'active' AND c.wo_as_present = true
  ) THEN
    RAISE EXCEPTION 'CLI3871 WO must count as Present';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cli3871_contracts_before b
    FULL JOIN public.client_contracts a ON a.id = b.id
    WHERE CASE WHEN b.id = 'a19ae14f-74b3-4d96-9689-d617edcbbb5c'
      THEN (to_jsonb(a) - 'wo_as_present' - 'updated_at')
        IS DISTINCT FROM (to_jsonb(b) - 'wo_as_present' - 'updated_at')
      ELSE to_jsonb(a) IS DISTINCT FROM to_jsonb(b) END
  ) THEN
    RAISE EXCEPTION 'Another client, historical contract or unrelated contract term changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cli3871_entries_before b
    FULL JOIN (SELECT * FROM public.attendance_entries
      WHERE unit_id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8') a ON a.id = b.id
    WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(b)
  ) THEN
    RAISE EXCEPTION 'Source attendance changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cli3871_resources_before b
    FULL JOIN (SELECT r.* FROM public.contract_resources r
      JOIN public.client_contracts c ON c.id = r.contract_id
      WHERE c.unit_id = 'ae2f53d1-492b-40a5-adc4-ce20d5b997a8') a ON a.id = b.id
    WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(b)
  ) THEN
    RAISE EXCEPTION 'Saved contract rates changed';
  END IF;
  RAISE NOTICE 'Verified CLI3871 WO as P; other clients, expired contracts, rates and attendance unchanged';
END $$;
COMMIT;