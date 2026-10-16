-- Sep 2026 state invoices, second pass (one invoice per branch site): billing-only rate alignment.
begin;
create table if not exists _bkp_sep_state_inv_rates2_20261017 as select * from contract_resources where id in ('0f45f7dc-eb8d-4f93-82bb-f25d34197cc9','10dd9747-1883-4bce-bb47-c775a5a948cd','b9ec5521-d758-45da-b6ad-56170f6180db','9b333b89-e197-46f2-9906-15b3274997bb','9769d5e6-2a6a-4477-b03c-605197367c1b','c4e9d22b-d798-4728-a98a-a7120bf02f10','ae0215db-ece5-4adb-a430-f35fbe8a813d','22b2f76d-c28d-4326-b464-1387c4cac597','ed69d3fa-db5b-4aa5-9e4b-7b10729e8fc6','97a6bbca-71cc-4027-adfe-9d1e92b04505','2c801d81-a081-4a7a-85eb-7366b1bda986','cf152250-0001-4001-8001-000000000001','cd485d38-7bab-44fb-a9e3-8aca53783d7a','f71f4994-efb1-47aa-94db-ed90e857c048','d5756c44-28ca-41a8-80e3-cbe7e50f2c30','d2fc31f5-a149-4319-89db-18085d10203f','79c00499-9296-426b-a22b-f49c79390dca','03d30649-247f-46b9-a8c2-9fcf29054c51','4601b7a7-6726-4755-bf0d-bd219d7c0c80','957e9e2f-a4e4-4557-be08-5c1dc33ed0ad','68ef765b-93ad-4595-b3bc-edecfe7d6b8b','523d7f00-d892-40af-9b87-0c1d4dfe1514','21ec6437-2eda-4b23-a519-c3a82126f492','c758d3f1-05d7-4285-aadd-9483f12cf16e','dfefc22a-63bf-446b-aebc-46cd9fbcccfb','6faf03b8-acb2-417c-8f3b-e37e20a2ee3b');
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice SEP26-27LTGJ0659)','state','N/A','amount',
   round(26988.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='0f45f7dc-eb8d-4f93-82bb-f25d34197cc9';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice SEP26-27LTKA0398)','state','N/A','amount',
   round(33327.06 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='10dd9747-1883-4bce-bb47-c775a5a948cd';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0406)','state','N/A','amount',
   round(24407.12 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='b9ec5521-d758-45da-b6ad-56170f6180db';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0406)','state','N/A','amount',
   round(27871.61 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='9b333b89-e197-46f2-9906-15b3274997bb';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0423)','state','N/A','amount',
   round(41507.81 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='9769d5e6-2a6a-4477-b03c-605197367c1b';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice SEP26-27LTRJ2886)','state','N/A','amount',
   round(22673.82 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='c4e9d22b-d798-4728-a98a-a7120bf02f10';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2893)','state','N/A','amount',
   round(35878.76 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30'), updated_at=now() where r.id='ae0215db-ece5-4adb-a430-f35fbe8a813d';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2893)','state','N/A','amount',
   round(37015.84 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30'), updated_at=now() where r.id='22b2f76d-c28d-4326-b464-1387c4cac597';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2893)','state','N/A','amount',
   round(30752.34 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='ed69d3fa-db5b-4aa5-9e4b-7b10729e8fc6';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2924)','state','N/A','amount',
   round(24057.8 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='97a6bbca-71cc-4027-adfe-9d1e92b04505';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2924)','state','N/A','amount',
   round(21784.36 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='2c801d81-a081-4a7a-85eb-7366b1bda986';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2942)','state','N/A','amount',
   round(31233.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='cf152250-0001-4001-8001-000000000001';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2953)','state','N/A','amount',
   round(22691.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30'), updated_at=now() where r.id='cd485d38-7bab-44fb-a9e3-8aca53783d7a';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2954)','state','N/A','amount',
   round(22691.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30'), updated_at=now() where r.id='f71f4994-efb1-47aa-94db-ed90e857c048';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3016)','state','N/A','amount',
   round(31882.11 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='d5756c44-28ca-41a8-80e3-cbe7e50f2c30';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3022)','state','N/A','amount',
   round(34759.92 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='d2fc31f5-a149-4319-89db-18085d10203f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3057)','state','N/A','amount',
   round(24488.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='79c00499-9296-426b-a22b-f49c79390dca';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3069)','state','N/A','amount',
   round(22474.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='03d30649-247f-46b9-a8c2-9fcf29054c51';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3047)','state','N/A','amount',
   round(32707.24 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='4601b7a7-6726-4755-bf0d-bd219d7c0c80';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3053)','state','N/A','amount',
   round(33001.55 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='957e9e2f-a4e4-4557-be08-5c1dc33ed0ad';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3053)','state','N/A','amount',
   round(30000.23 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='68ef765b-93ad-4595-b3bc-edecfe7d6b8b';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3050)','state','N/A','amount',
   round(40440.21 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='523d7f00-d892-40af-9b87-0c1d4dfe1514';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3050)','state','N/A','amount',
   round(30953.95 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='21ec6437-2eda-4b23-a519-c3a82126f492';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3110)','state','N/A','amount',
   round(18280.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='c758d3f1-05d7-4285-aadd-9483f12cf16e';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3112)','state','N/A','amount',
   round(18280.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='dfefc22a-63bf-446b-aebc-46cd9fbcccfb';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3098)','state','N/A','amount',
   round(22997.32 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30'), updated_at=now() where r.id='6faf03b8-acb2-417c-8f3b-e37e20a2ee3b';
commit;
