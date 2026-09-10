-- Preserve the exact source-card decimals for CON15246 (Pune Security Guard).
-- The printed rows round HRA and Uniform for display, while Total Cost uses
-- the underlying ₹2,574.90 and ₹686.56 values.
WITH target AS (
  SELECT cr.id
  FROM public.contract_resources cr
  JOIN public.client_contracts cc ON cc.id = cr.contract_id
  JOIN public.units u ON u.id = cc.unit_id
  WHERE cc.contract_code = 'CON15246'
    AND u.code = 'CLI1408'
), updated AS (
  SELECT
    cr.id,
    (
      SELECT jsonb_agg(
        CASE WHEN lower(item->>'name') = 'hra'
          THEN jsonb_set(item, '{amount}', to_jsonb(2574.90::numeric), true)
          ELSE item
        END
        ORDER BY ordinality
      )
      FROM jsonb_array_elements(cr.components) WITH ORDINALITY AS rows(item, ordinality)
    ) AS components,
    (
      SELECT jsonb_agg(
        CASE WHEN item->>'name' = 'Uniform Allowance'
          THEN jsonb_set(item, '{amount}', to_jsonb(686.56::numeric), true)
          ELSE item
        END
        ORDER BY ordinality
      )
      FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY AS rows(item, ordinality)
    ) AS employer_contributions
  FROM public.contract_resources cr
  JOIN target ON target.id = cr.id
)
UPDATE public.contract_resources cr
SET components = updated.components,
    employer_contributions = updated.employer_contributions,
    gross = 22540.90,
    updated_at = now()
FROM updated
WHERE cr.id = updated.id;
