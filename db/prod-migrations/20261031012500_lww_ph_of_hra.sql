INSERT INTO public.cost_components
  (name, code, calc_type, percentage, base_components, state, party,
   formula_mode, formula_expression, formula_version, enabled, description)
SELECT v.name, v.code, 'percentage', v.pct, '[]'::jsonb, 'N/A', 'employer',
  'advanced', v.expr, 1, true, v.descr
FROM (VALUES
  ('Leave with Wages 6% (HRA)', 'LWW_HRA_6', 6::numeric, 'hra * 0.06', 'Leave with Wages calculated as 6% of HRA.'),
  ('Paid Holiday 1% (HRA)', 'PH_HRA_1', 1::numeric, 'hra * 0.01', 'Paid Holiday calculated as 1% of HRA.')
) AS v(name, code, pct, expr, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_components c WHERE c.code = v.code OR c.name = v.name
);
