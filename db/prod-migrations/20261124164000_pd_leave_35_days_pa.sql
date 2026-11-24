-- Separate selectable employer contribution; do not modify existing rates or contracts.
INSERT INTO public.cost_components (
  name, code, calc_type, percentage, base_components,
  cap_amount, cap_flat_amount, amount, state, enabled,
  formula_mode, formula_expression, party, description
)
SELECT
  'P.D. Leave (35 Days PA)', 'ER_PD_LEAVE_35_DAYS_PA', 'percentage', 10.25,
  '[{"label":"Basic","operator":"+"},{"label":"DA","operator":"+"}]'::jsonb,
  NULL, NULL, NULL, 'N/A', true,
  'advanced', '(basic + da) * 0.1025', 'employer',
  '(Basic + DA) × 10.25%'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE lower(code) = lower('ER_PD_LEAVE_35_DAYS_PA')
);