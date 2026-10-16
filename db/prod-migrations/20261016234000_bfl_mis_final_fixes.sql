-- BFL Sep MIS final fixes (role billing to MIS rate, Goregaon bouncer line, Jalna stray entry)
insert into _bkp_bfl_mis_multirole_20261016 select * from contract_resources where id in
 ('7a70e824-3c6d-4b57-822d-56f907fe9a01','3f1e46cb-51c4-4239-81f1-590620abfd3b','3370b4f9-dca3-4de3-9241-669b16cf0940','4b5e85c4-7b4d-4bb4-9089-27ce47939c72','ec2ca16a-4500-47df-b0e5-31ef65cd3a8f','7a6e9ee8-be9f-483b-aedb-b5942216bc9d');
create table if not exists _bkp_bfl_jalna_att_20261016 as select ae.* from attendance_entries ae join units u on u.id=ae.unit_id where u.code='CLI1970' and ae.entry_date between '2026-08-21' and '2026-09-20';
-- set Billing Rate Adjustment so billable = target
with t(id,target) as (values
 ('7a70e824-3c6d-4b57-822d-56f907fe9a01'::uuid,32085.46),
 ('3f1e46cb-51c4-4239-81f1-590620abfd3b'::uuid,21974.62),
 ('3370b4f9-dca3-4de3-9241-669b16cf0940'::uuid,32085.46),
 ('4b5e85c4-7b4d-4bb4-9089-27ce47939c72'::uuid,36831.60),
 ('ec2ca16a-4500-47df-b0e5-31ef65cd3a8f'::uuid,36831.60),
 ('7a6e9ee8-be9f-483b-aedb-b5942216bc9d'::uuid,28557.34)),
v as (select r.id, round(t.target - r.gross - coalesce((select sum((e->>'amount')::numeric) from jsonb_array_elements(r.employer_contributions) e where e->>'name' not like 'Billing Rate Adjustment%'),0),2) a from contract_resources r join t on t.id=r.id)
update contract_resources r set employer_contributions =
  (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
  || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice)','state','N/A','amount',v.a,'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
  updated_at=now()
from v where r.id=v.id;
-- Goregaon (CLI512): add Bouncer line, copied from Thane bouncer (MIS 33,409.77 on 26 days)
insert into contract_resources (contract_id, designation_id, service_type_id, quantity, components, gross, sort_order, payroll_day_base_id, benefits, deductions, employer_contributions, role_key, shift_hours, billing_day_base_id, round_off_final, round_off_totals, ot_multiplier, ot_basis, ot_formula)
select '19df1958-8e8d-4fc3-9a92-3d0cf1cb9b56', '0ec2821e-3d7a-47d5-b68c-d6e4daf378b4', service_type_id, 1, components, gross, 99, payroll_day_base_id, benefits, deductions, employer_contributions, role_key, shift_hours, billing_day_base_id, round_off_final, round_off_totals, ot_multiplier, ot_basis, ot_formula
from contract_resources where id='413a404f-e4c5-4a74-9cec-1fbcff3bcbef'
and not exists (select 1 from contract_resources where contract_id='19df1958-8e8d-4fc3-9a92-3d0cf1cb9b56' and designation_id='0ec2821e-3d7a-47d5-b68c-d6e4daf378b4');
-- Jalna Sarafa Bazar: MIS days are at active CLI2782; drop stray Field Officer entry on inactive CLI1970
delete from attendance_entries where id in (select id from _bkp_bfl_jalna_att_20261016);
