-- CON13043 AWL Alwar: "ESI (Gross-WA)" used fixed monthly gross, so Extra Duty was left out
-- (other roles at this site include ED). Use earned gross (includes ED) minus WA.
BEGIN;
UPDATE public.cost_components SET formula_expression='(earned_gross - washing_allowance) * 0.0075', updated_at=now() WHERE id='cc130430-0001-4001-8001-000000000003';
UPDATE public.cost_components SET formula_expression='(earned_gross - washing_allowance) * 0.0325', updated_at=now() WHERE id='cc130430-0001-4001-8001-000000000004';
UPDATE public.contract_resources cr SET
  deductions=(SELECT jsonb_agg(CASE WHEN e->>'costComponentId'='cc130430-0001-4001-8001-000000000003' THEN jsonb_set(e,'{formulaExpression}','"(earned_gross - washing_allowance) * 0.0075"') ELSE e END ORDER BY o) FROM jsonb_array_elements(cr.deductions) WITH ORDINALITY t(e,o)),
  employer_contributions=(SELECT jsonb_agg(CASE WHEN e->>'costComponentId'='cc130430-0001-4001-8001-000000000004' THEN jsonb_set(e,'{formulaExpression}','"(earned_gross - washing_allowance) * 0.0325"') ELSE e END ORDER BY o) FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY t(e,o)),
  updated_at=now()
WHERE cr.deductions::text LIKE '%cc130430-0001-4001-8001-000000000003%' OR cr.employer_contributions::text LIKE '%cc130430-0001-4001-8001-000000000004%';
COMMIT;
