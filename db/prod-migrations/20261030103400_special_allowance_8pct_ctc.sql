INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, state, party,
   formula_mode, formula_expression, formula_version, enabled, description)
SELECT 'Special Allowance 8% (Total CTC)', 'SPECIAL_ALLOWANCE_CTC_8', 'percentage', 8,
  '[]'::jsonb, 'N/A', 'employer', 'advanced', 'total_ctc * 0.08', 1, true,
  'Special Allowance calculated as 8% of Total CTC.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE code = 'SPECIAL_ALLOWANCE_CTC_8'
);