INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, state, party,
   formula_mode, formula_expression, formula_version, enabled, description)
SELECT 'Management Fee 10% (Total CTC)', 'MGMT_CTC_10', 'percentage', 10,
  '[]'::jsonb, 'N/A', 'employer', 'advanced', 'total_ctc * 0.10', 1, true,
  '10% of Total CTC, excluding reliever charges and management fee.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE formula_expression = 'total_ctc * 0.10' AND enabled
);
