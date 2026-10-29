-- Additional employee ESIC choice only; existing masters and contracts stay unchanged.
INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, cap_amount, cap_flat_amount,
   state, party, deduction_calc_type, formula_mode, formula_expression,
   formula_version, enabled, description)
SELECT 'EE ESIC 3.25% (Gross-Conveyance-Washing)',
  'EE_ESIC_325_GROSS_MINUS_CONVEYANCE_WASHING', 'percentage', 3.25,
  '[{"label":"Gross","operator":"+"},{"label":"Conveyance Allowance","operator":"-"},{"label":"Washing Allowance","operator":"-"}]'::jsonb,
  NULL, NULL, 'N/A', 'employee', 'earned_salary', 'advanced',
  '(gross - conveyance_allowance - washing_allowance) * 0.0325', 1, true,
  'Employee ESIC: 3.25% of Gross minus Conveyance Allowance and Washing Allowance. HRA is not excluded. Select explicitly on a contract employee contribution line.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE code = 'EE_ESIC_325_GROSS_MINUS_CONVEYANCE_WASHING'
);