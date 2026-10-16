insert into _bkp_bfl_mis_rates_20261016 select r.* from contract_resources r where id in ('3f1e46cb-51c4-4239-81f1-590620abfd3b','387439a3-7624-451f-8ccb-85b6398d210f');
with v(id,a) as (values ('3f1e46cb-51c4-4239-81f1-590620abfd3b'::uuid,4664.84),('387439a3-7624-451f-8ccb-85b6398d210f'::uuid,-0.15))
update contract_resources r set employer_contributions =
  (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
  || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice)','state','N/A','amount',v.a,'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
  updated_at=now()
from v where r.id=v.id;
