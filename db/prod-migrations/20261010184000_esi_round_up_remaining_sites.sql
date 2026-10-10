-- ESI rounds up to the next rupee on every role, matching the rest of the site
-- (six sites had Lady Guard / Gardener / office lines left unrounded).
BEGIN;
UPDATE public.contract_resources cr
SET deductions = (SELECT jsonb_agg(CASE WHEN e->>'name' ~* '\mesic?\M' THEN e || '{"roundMode":"up"}'::jsonb ELSE e END ORDER BY ord) FROM jsonb_array_elements(cr.deductions) WITH ORDINALITY t(e, ord)),
    employer_contributions = (SELECT jsonb_agg(CASE WHEN e->>'name' ~* '\mesic?\M' THEN e || '{"roundMode":"up"}'::jsonb ELSE e END ORDER BY ord) FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY t(e, ord)),
    updated_at = now()
FROM public.client_contracts c
WHERE c.id = cr.contract_id AND c.status = 'active'
  AND c.unit_id IN ('253fd48f-0c30-4102-b69c-4e99e812b196','bbe91876-bb6a-4cf9-b38a-aaf959aa59a4','3b29baf8-c886-416d-8631-6730f3ab442b','05713420-d2d7-4cc3-9b42-b66b5112fd8d','3fa2302a-9bee-4f6a-8f7b-4ed563bf2965','3248c96e-a242-4eb8-ba5d-f657376679a1')
  AND jsonb_array_length(cr.deductions) > 0 AND jsonb_array_length(cr.employer_contributions) > 0;
COMMIT;
