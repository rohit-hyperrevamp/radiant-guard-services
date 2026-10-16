-- BFL Sep 2026 MIS: remaining single Security Guard lines whose billing differed by more than ₹3,100 from the MIS SG Rate.
insert into _bkp_bfl_mis_rates_20261016 select r.* from contract_resources r where r.id in (select v.id from (values ('1a4123f2-a852-4a50-9ea1-0a918aa36f7d'::uuid,-4726.25),
('d66608ac-be12-41cb-968a-c46b2e2d1e60'::uuid,-15899.94),
('a6ee8b86-5fb4-4226-949f-a767de5b6780'::uuid,-8372.22),
('0c2afcfc-9471-47ed-a55c-651065822660'::uuid,-8372.22),
('7ff97a26-081b-42e3-826a-91b316256820'::uuid,4664.84)) v(id,a));
with v(id,a) as (values ('1a4123f2-a852-4a50-9ea1-0a918aa36f7d'::uuid,-4726.25),
('d66608ac-be12-41cb-968a-c46b2e2d1e60'::uuid,-15899.94),
('a6ee8b86-5fb4-4226-949f-a767de5b6780'::uuid,-8372.22),
('0c2afcfc-9471-47ed-a55c-651065822660'::uuid,-8372.22),
('7ff97a26-081b-42e3-826a-91b316256820'::uuid,4664.84))
update contract_resources r set employer_contributions =
  (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
  || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice)','state','N/A','amount',v.a,'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
  updated_at=now()
from v where r.id=v.id;
