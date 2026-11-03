-- This Gross-labelled master had no linked employer contract lines at correction time.
-- Keep the separately named allowance-exclusion masters unchanged.
UPDATE public.cost_components
SET formula_mode = 'advanced',
    formula_expression = 'round(gross * 0.0325)',
    percentage = 3.25,
    base_components = '[{"label":"Gross","operator":"+"}]'::jsonb,
    formula_version = formula_version + 1,
    description = 'Employer ESIC 3.25% of full Gross, rounded to the nearest rupee. No wage allowance is excluded.',
    notes = 'Full Gross includes Conveyance and Washing. Use the separately named Gross-Conveyance-Washing choice when exclusions are required.'
WHERE id = '3f158afc-49e2-451d-baff-793c477f0290'
  AND name = 'ER ESI Contribution (Gross)'
  AND formula_expression = '{"base":{"kind":"composite","components":[{"name":"Earned Gross","operator":"+"},{"name":"Washing Allowance","operator":"-"},{"name":"Conveyance Allowance","operator":"-"}]},"operator":"percent","percent":3.25,"capAmount":21000,"floorAmount":null,"multipliers":[]}';