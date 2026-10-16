-- Sep 2026 state invoices, Pages-confirmed site mapping: billing-only rate alignment.
begin;
create table if not exists _bkp_sep_state_inv_rates3_20261017 as select * from contract_resources where id in ('fc1fd928-c1af-45c8-a47c-20987ad18dc8','a5f32da2-5c01-4ef5-a8f6-fbf83388c742','fa997687-6315-4629-a7f1-db6751e06c15','b1912c5a-6181-42bc-9241-eef053bf3d3d','38e65718-1d74-47d3-98f1-634072122d91','c2e0aea3-1d40-411f-979b-68a70fb9dc4b','3ff4edd9-cf8a-416b-8120-0c7fc0a1940f','cf161330-0001-4001-8001-000000000002','cf161330-0001-4001-8001-000000000001','f04ec72b-9433-4096-98c2-5036191c9928','53a4f716-a7b6-4202-bc36-587e2e0683a4','bbd06c34-f7e6-4d23-89a9-5ced4aaf5052');
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0806)','state','N/A','amount',
   round(29044.32 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='fc1fd928-c1af-45c8-a47c-20987ad18dc8';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0419)','state','N/A','amount',
   round(28415.48 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='a5f32da2-5c01-4ef5-a8f6-fbf83388c742';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3058)','state','N/A','amount',
   round(26023.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='fa997687-6315-4629-a7f1-db6751e06c15';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3058)','state','N/A','amount',
   round(24488.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='b1912c5a-6181-42bc-9241-eef053bf3d3d';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3068)','state','N/A','amount',
   round(22474.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='38e65718-1d74-47d3-98f1-634072122d91';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3076)','state','N/A','amount',
   round(35531.11 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='c2e0aea3-1d40-411f-979b-68a70fb9dc4b';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3113)','state','N/A','amount',
   round(25318.48 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='3ff4edd9-cf8a-416b-8120-0c7fc0a1940f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3125)','state','N/A','amount',
   round(37118.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='cf161330-0001-4001-8001-000000000002';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3125)','state','N/A','amount',
   round(36081.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='cf161330-0001-4001-8001-000000000001';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3097)','state','N/A','amount',
   round(28182.38 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30'), updated_at=now() where r.id='f04ec72b-9433-4096-98c2-5036191c9928';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3278)','state','N/A','amount',
   round(29734.39 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='53a4f716-a7b6-4202-bc36-587e2e0683a4';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3319)','state','N/A','amount',
   round(27496.5 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='bbd06c34-f7e6-4d23-89a9-5ced4aaf5052';
commit;
