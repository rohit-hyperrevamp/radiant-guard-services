BEGIN;

INSERT INTO public.cost_components (id, name, calc_type, percentage, formula_mode, formula_expression, party, state, sort_order, notes)
VALUES ('cc118200-0001-4001-8001-000000000001','Leave with Wages 11.82% (Basic+DA) Employer Cost','percentage',11.82,'advanced','(basic + da) * 0.1182','employer','Karnataka',100,'L&T Karnataka rate card (leave with wages incl. national holidays)')
ON CONFLICT (id) DO NOTHING;

-- CON14691 / CON14692: leave with wages 11.82%, not 6%
UPDATE public.contract_resources r
SET employer_contributions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'name' = 'Leave with Wages 6% (Basic+DA) Employer Cost'
      THEN e || jsonb_build_object(
        'name','Leave with Wages 11.82% (Basic+DA) Employer Cost',
        'percentage',11.82,
        'calcType','percentage',
        'formulaMode','advanced',
        'formulaExpression','(basic + da) * 0.1182',
        'costComponentId','cc118200-0001-4001-8001-000000000001',
        'amount',2245.41)
      ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(r.employer_contributions) WITH ORDINALITY t(e,ord))
FROM public.client_contracts c
WHERE c.id = r.contract_id AND c.contract_code IN ('CON14691','CON14692');

-- CON15932 / CON15933 / CON15997: bonus 8.33% and gratuity 4.81%
UPDATE public.contract_resources r
SET employer_contributions = (
  SELECT jsonb_agg(
    CASE
      WHEN e->>'name' = 'Bonus / Exgratia 10% (Basic+DA) Employer Cost'
        THEN e || jsonb_build_object(
          'name','Bonus / Exgratia 8.33% (Basic+DA) Employer Cost',
          'percentage',8.33,
          'calcType','percentage',
          'formulaMode','advanced',
          'formulaExpression','(basic + da) * 0.0833',
          'costComponentId','cc159000-0001-4001-8001-000000000003',
          'amount',1293.82)
      WHEN e->>'name' = 'Gratuity 4% (Basic+DA)'
        THEN e || jsonb_build_object(
          'name','Gratuity 4.81% (Basic+DA)',
          'percentage',4.81,
          'calcType','percentage',
          'formulaMode','advanced',
          'formulaExpression','(basic + da) * 0.0481',
          'costComponentId','cc161170-0001-4001-8001-000000000002',
          'amount',747.09)
      ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(r.employer_contributions) WITH ORDINALITY t(e,ord))
FROM public.client_contracts c
WHERE c.id = r.contract_id AND c.contract_code IN ('CON15932','CON15933','CON15997');

COMMIT;
