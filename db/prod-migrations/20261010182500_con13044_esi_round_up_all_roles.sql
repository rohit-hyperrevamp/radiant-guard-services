-- CLI2285 AWL Bundi (CON13044): every role's ESI line rounds up to the next rupee,
-- like the Security Guard / Supervisor / Computer Operator lines already do.
BEGIN;
UPDATE public.contract_resources cr
SET deductions = (
      SELECT jsonb_agg(CASE WHEN e->>'name' ~* '\mesic?\M' THEN e || '{"roundMode":"up"}'::jsonb ELSE e END ORDER BY ord)
      FROM jsonb_array_elements(cr.deductions) WITH ORDINALITY t(e, ord)),
    employer_contributions = (
      SELECT jsonb_agg(CASE WHEN e->>'name' ~* '\mesic?\M' THEN e || '{"roundMode":"up"}'::jsonb ELSE e END ORDER BY ord)
      FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY t(e, ord)),
    updated_at = now()
FROM public.client_contracts c
WHERE c.id = cr.contract_id AND c.contract_code = 'CON13044'
  AND jsonb_typeof(cr.deductions) = 'array' AND jsonb_typeof(cr.employer_contributions) = 'array'
  AND jsonb_array_length(cr.employer_contributions) > 0;
COMMIT;
