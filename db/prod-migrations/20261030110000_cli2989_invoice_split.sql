-- Site-only invoice output correction; attendance, payroll and rates unchanged.
BEGIN;
UPDATE public.invoice_extra_charges
SET enabled = false, updated_at = now()
WHERE id = 'a79ff097-4982-4750-96ae-a3b38c0c52ec'
  AND unit_id = 'a5f17bdb-32fb-4f1d-b46a-7432815451bd';
UPDATE public.client_contracts
SET invoice_split = '{"parts":[{"key":"main","label":"P Days"},{"key":"ed","label":"Extra Duty"}],"assign":{"regular":"main","ph":"main","ed":"ed","reliever":"ed","extras":"main"}}'::jsonb,
    updated_at = now()
WHERE id = '05ac53f3-6cae-4d94-80a1-893089033c0b'
  AND unit_id = 'a5f17bdb-32fb-4f1d-b46a-7432815451bd';
COMMIT;