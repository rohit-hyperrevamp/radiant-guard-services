-- Wage-component (Add allowance) formula: Remote Area Allowance = 37.9% of (Basic + DA).
INSERT INTO public.allowance_types
  (name, display_name, short_name, calc_type, percentage, base_components,
   include_in_ot, formula, day_driver, counts_in_t_days, formula_mode,
   formula_expression, formula_version, fixed_calc_method, fixed_duty_components, enabled, is_default)
SELECT 'Remote Area Allowance 37.9% (Basic+DA)', 'Remote Area Allowance', 'Remote Area', 'percentage', 37.9, '[]'::jsonb,
  true, '{}'::jsonb, 'ratio', false, 'advanced', '(basic + da) * 0.379', 1, 'flat', '{p_days}', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.allowance_types a WHERE a.name = 'Remote Area Allowance 37.9% (Basic+DA)');
