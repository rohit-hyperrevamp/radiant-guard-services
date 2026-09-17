BEGIN;

UPDATE public.contract_resources cr
SET employer_contributions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'costComponentId' = 'cc143130-0001-4001-8001-000000000001'
        AND elem->>'name' = 'Gratuity 4% (Basic+DA)'
      THEN elem || jsonb_build_object(
        'name', 'Gratuity 4.81% (Basic+DA)',
        'costComponentId', 'cc161170-0001-4001-8001-000000000002',
        'calcType', 'percentage',
        'percentage', 4.81,
        'formulaMode', 'advanced',
        'formulaExpression', '(basic + da) * 0.0481',
        'formulaVersion', 1
      )
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY AS e(elem, ord)
)
FROM public.client_contracts cc
JOIN public.units u ON u.id = cc.unit_id
WHERE cr.contract_id = cc.id
  AND u.code = 'CLI2921'
  AND cc.contract_code = 'CON16182'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(cr.employer_contributions) elem
    WHERE elem->>'costComponentId' = 'cc143130-0001-4001-8001-000000000001'
      AND elem->>'name' = 'Gratuity 4% (Basic+DA)'
  );

COMMIT;
