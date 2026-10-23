-- Additional employee deduction option; existing capped EPF masters stay unchanged.
INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, cap_amount, cap_flat_amount,
   state, party, deduction_calc_type, formula_mode, formula_expression,
   formula_version, enabled, description)
SELECT 'EE EPF 12% (Gross-HRA)', 'EE_EPF_12_GROSS_MINUS_HRA', 'percentage', 12,
  '[{"label":"Gross","operator":"+"},{"label":"HRA","operator":"-"}]'::jsonb,
  NULL, NULL, 'N/A', 'employee', 'earned_salary', 'advanced',
  '(gross - hra) * 0.12', 1, true,
  'Employee EPF: 12% of Gross minus HRA, without a formula cap. Select explicitly on a contract deduction line.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE code = 'EE_EPF_12_GROSS_MINUS_HRA'
);