INSERT INTO public.cost_components
  (name, code, calc_type, percentage, amount, base_components, state, party,
   formula_mode, formula_expression, fixed_calc_method, enabled, description)
SELECT 'Special Allowance', 'SPECIAL_ALLOWANCE_MANUAL', 'fixed', 0, NULL,
  '[]'::jsonb, 'N/A', 'employer', 'preset', NULL, 'flat', true,
  'Special Allowance with a manually entered contract amount; no percentage formula.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components WHERE code = 'SPECIAL_ALLOWANCE_MANUAL'
);