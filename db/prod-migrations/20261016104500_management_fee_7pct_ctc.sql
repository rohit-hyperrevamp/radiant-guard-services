-- Add a distinct selectable formula; leave all existing contract choices unchanged.
INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, state, party,
   formula_mode, formula_expression, formula_version, enabled, description)
SELECT 'Management Fee 7% (Total CTC)', 'MGMT_CTC_7', 'percentage', 7,
  '[]'::jsonb, 'N/A', 'employer', 'advanced', 'total_ctc * 0.07', 1, true,
  '7% of Total CTC, excluding reliever charges and management fee.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components
  WHERE name = 'Management Fee 7% (Total CTC)'
    AND formula_expression = 'total_ctc * 0.07' AND enabled
);