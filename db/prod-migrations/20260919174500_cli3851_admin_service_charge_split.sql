-- CLI3851 (CON14811) Un-skilled Zone-II cost sheet reconciliation.
-- Client sheet shows Admin Charges 1200.00 + Service Charge 600.00 (Total cost 28026.11).
-- Our record carried a single Service Charge of 1835.83 (total 28061.95).
begin;

with target as (
  select r.id
    from contract_resources r
    join client_contracts c on c.id = r.contract_id
    join units u on u.id = c.unit_id
   where u.code = 'CLI3851'
     and c.contract_code = 'CON14811'
)
update contract_resources r
   set employer_contributions = (
         select jsonb_agg(
                  case when e->>'costComponentId' = 'cc900000-0001-4001-8001-000000000002'
                       then jsonb_set(e, '{amount}', '600'::jsonb)
                       else e end
                  order by ord
                )
           from jsonb_array_elements(r.employer_contributions) with ordinality t(e, ord)
       )
       || jsonb_build_array(jsonb_build_object(
            'name', 'Admin Charges (Fixed)',
            'state', 'N/A',
            'amount', 1200,
            'calcType', 'fixed',
            'capAmount', null,
            'percentage', 0,
            'formulaMode', 'preset',
            'capFlatAmount', null,
            'baseComponents', '[]'::jsonb,
            'formulaVersion', 1,
            'costComponentId', 'cc900000-0001-4001-8001-000000000001',
            'fixedCalcMethod', 'flat',
            'fixedDutyDivisor', null,
            'deductionCalcType', 'fixed_amount',
            'formulaExpression', null,
            'fixedDutyComponents', '[]'::jsonb
          )),
       updated_at = now()
 where r.id in (select id from target)
   and not exists (
     select 1 from jsonb_array_elements(r.employer_contributions) e
      where e->>'costComponentId' = 'cc900000-0001-4001-8001-000000000001'
   );

commit;
