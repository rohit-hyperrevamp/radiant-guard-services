-- Keep the shared "ESI (Gross-WA)" masters unchanged for the other 54 contracts;
-- add Earned Gross - WA masters (include Extra Duty) and point only CON13043 (AWL Alwar) at them.
BEGIN;
UPDATE public.cost_components SET formula_expression='(gross - washing_allowance) * 0.0075', updated_at=now() WHERE id='cc130430-0001-4001-8001-000000000003';
UPDATE public.cost_components SET formula_expression='(gross - washing_allowance) * 0.0325', updated_at=now() WHERE id='cc130430-0001-4001-8001-000000000004';
INSERT INTO public.cost_components (id,name,calc_type,percentage,base_components,deduction_calc_type,fixed_calc_method,fixed_duty_components,formula_mode,formula_expression,formula_version,party,enabled,code,day_driver,sort_order,state)
SELECT 'cc130430-0001-4001-8001-000000000013','EE ESI 0.75% (Earned Gross-WA)',calc_type,percentage,base_components,deduction_calc_type,fixed_calc_method,fixed_duty_components,'advanced','(earned_gross - washing_allowance) * 0.0075',1,party,true,code||'-EG',day_driver,sort_order,state FROM public.cost_components WHERE id='cc130430-0001-4001-8001-000000000003'
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.cost_components (id,name,calc_type,percentage,base_components,deduction_calc_type,fixed_calc_method,fixed_duty_components,formula_mode,formula_expression,formula_version,party,enabled,code,day_driver,sort_order,state)
SELECT 'cc130430-0001-4001-8001-000000000014','ER ESI 3.25% (Earned Gross-WA)',calc_type,percentage,base_components,deduction_calc_type,fixed_calc_method,fixed_duty_components,'advanced','(earned_gross - washing_allowance) * 0.0325',1,party,true,code||'-EG',day_driver,sort_order,state FROM public.cost_components WHERE id='cc130430-0001-4001-8001-000000000004'
ON CONFLICT (id) DO NOTHING;
-- other contracts: back to original line expression
UPDATE public.contract_resources cr SET
  deductions=(SELECT jsonb_agg(CASE WHEN e->>'costComponentId'='cc130430-0001-4001-8001-000000000003' THEN jsonb_set(e,'{formulaExpression}','"(gross - washing_allowance) * 0.0075"') ELSE e END ORDER BY o) FROM jsonb_array_elements(cr.deductions) WITH ORDINALITY t(e,o)),
  employer_contributions=(SELECT jsonb_agg(CASE WHEN e->>'costComponentId'='cc130430-0001-4001-8001-000000000004' THEN jsonb_set(e,'{formulaExpression}','"(gross - washing_allowance) * 0.0325"') ELSE e END ORDER BY o) FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY t(e,o))
WHERE (cr.deductions::text LIKE '%cc130430-0001-4001-8001-000000000003%' OR cr.employer_contributions::text LIKE '%cc130430-0001-4001-8001-000000000004%');
-- AWL Alwar CON13043: switch to the earned-gross masters
UPDATE public.contract_resources cr SET
  deductions=(SELECT jsonb_agg(CASE WHEN e->>'costComponentId'='cc130430-0001-4001-8001-000000000003' THEN e || '{"costComponentId":"cc130430-0001-4001-8001-000000000013","name":"EE ESI 0.75% (Earned Gross-WA)","formulaExpression":"(earned_gross - washing_allowance) * 0.0075"}'::jsonb ELSE e END ORDER BY o) FROM jsonb_array_elements(cr.deductions) WITH ORDINALITY t(e,o)),
  employer_contributions=(SELECT jsonb_agg(CASE WHEN e->>'costComponentId'='cc130430-0001-4001-8001-000000000004' THEN e || '{"costComponentId":"cc130430-0001-4001-8001-000000000014","name":"ER ESI 3.25% (Earned Gross-WA)","formulaExpression":"(earned_gross - washing_allowance) * 0.0325"}'::jsonb ELSE e END ORDER BY o) FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY t(e,o)),
  updated_at=now()
WHERE cr.contract_id IN (SELECT id FROM public.client_contracts WHERE contract_code='CON13043');
COMMIT;
