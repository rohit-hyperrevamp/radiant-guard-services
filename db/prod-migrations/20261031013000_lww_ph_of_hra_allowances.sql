-- Wage-component (Add allowance) versions of LWW 6% of HRA and PH 1% of HRA.
INSERT INTO public.allowance_types
  (name, display_name, short_name, calc_type, percentage, base_components,
   include_in_ot, formula, day_driver, counts_in_t_days, formula_mode,
   formula_expression, formula_version, fixed_calc_method, fixed_duty_components, enabled, is_default)
SELECT v.name, v.display_name, v.short_name, 'percentage', v.pct, '[]'::jsonb,
  true, '{}'::jsonb, 'ratio', false, 'advanced', v.expr, 1, 'flat', '{p_days}', true, false
FROM (VALUES
  ('Leave with Wages 6% (HRA)', 'Leave Pay / LWW 6% (HRA)', 'LWW 6% (HRA)', 6::numeric, 'hra * 0.06'),
  ('Paid Holiday 1% (HRA)', 'Paid Holiday / PH 1% (HRA)', 'PH 1% (HRA)', 1::numeric, 'hra * 0.01')
) AS v(name, display_name, short_name, pct, expr)
WHERE NOT EXISTS (SELECT 1 FROM public.allowance_types a WHERE a.name = v.name);
