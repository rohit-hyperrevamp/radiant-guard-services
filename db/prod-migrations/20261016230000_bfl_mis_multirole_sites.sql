-- BFL Sep MIS: role-wise billing from Pages roles (CLI1760 Security Officer, CLI513 Bouncer) + CLI2256 ED rounding
create table if not exists _bkp_bfl_mis_multirole_20261016 as select * from contract_resources where false;
insert into _bkp_bfl_mis_multirole_20261016 select * from contract_resources where id in ('5c0edf37-126f-4008-9711-d731ba2e784c','413a404f-e4c5-4a74-9cec-1fbcff3bcbef');
create table if not exists _bkp_bfl_mis_cli2256_att_20261016 as select * from attendance_entries where id='10f5b93d-0218-4a4d-96bc-ab53a0b8d84c';
with v(id,a) as (values ('5c0edf37-126f-4008-9711-d731ba2e784c'::uuid,6276.70),('413a404f-e4c5-4a74-9cec-1fbcff3bcbef'::uuid,-9459.32))
update contract_resources r set employer_contributions =
  (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
  || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice)','state','N/A','amount',v.a,'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
  updated_at=now()
from v where r.id=v.id;
update contract_resources set billing_day_base_id='abea52aa-6151-4d0a-9209-f102d3ecf226', updated_at=now() where id='413a404f-e4c5-4a74-9cec-1fbcff3bcbef';
update attendance_entries set ot_hours=0, updated_at=now() where id='10f5b93d-0218-4a4d-96bc-ab53a0b8d84c';
