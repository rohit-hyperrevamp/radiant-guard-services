INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, state, party,
   formula_mode, formula_expression, formula_version, enabled, description)
SELECT 'Management Fee 10% (Total Gross)', 'MGMT_GROSS_10', 'percentage', 10,
  '[]'::jsonb, 'N/A', 'employer', 'advanced', 'gross * 0.10', 1, true,
  '10% of total gross salary, before employee deductions; excludes employer contributions and billing add-ons.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE code = 'MGMT_GROSS_10'
);