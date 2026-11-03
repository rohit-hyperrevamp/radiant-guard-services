-- Management Fee 7% of the actual billing rate (Total CTC + the contract's own reliever line).
-- The older "Management Fee 7% (CTC + Reliever)" assumes a fixed 16.67% reliever, which overstates
-- the fee on contracts whose reliever is round(ctc)/26*4 (15.38%), e.g. CLI325.
INSERT INTO public.cost_components (name, calc_type, percentage, base_components, state, notes, enabled, sort_order,
  deduction_calc_type, fixed_calc_method, fixed_duty_components, code, formula, day_driver, formula_mode,
  formula_expression, formula_version, party)
SELECT 'Management Fee 7% (Billing Rate)', 'percentage', 7, '[]'::jsonb, 'N/A', '', true, 0,
  'earned_salary', 'flat', '[]'::jsonb, 'MGMT_BILLING_RATE_7', '{}'::jsonb, 'ratio', 'advanced',
  'billing_rate * 0.07', 1, 'employer'
WHERE NOT EXISTS (SELECT 1 FROM public.cost_components WHERE name = 'Management Fee 7% (Billing Rate)');
