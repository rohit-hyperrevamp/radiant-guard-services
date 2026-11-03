-- Employer contribution formula: Leave 8.33% of Basic + DA.
-- Party 'employer', no cap. Existing contracts unchanged.
insert into public.cost_components (name, calc_type, percentage, base_components, state, notes, enabled, sort_order, deduction_calc_type, fixed_calc_method, fixed_duty_components, code, formula, day_driver, formula_mode, formula_expression, formula_version, party, description)
select 'Leave 8.33% (Basic + DA)', 'percentage', 8.33, '[{"label":"Basic","operator":"+"},{"label":"DA","operator":"+"}]'::jsonb, 'N/A', '', true, 0, 'earned_salary', 'flat', '{}'::text[], 'ER_LEAVE_BASIC_DA_833', '{}'::jsonb, 'ratio', 'advanced', '(basic + da) * 0.0833', 1, 'employer', 'Employer leave contribution: 8.33% of Basic plus DA, no cap.'
where not exists (select 1 from public.cost_components where code = 'ER_LEAVE_BASIC_DA_833');
