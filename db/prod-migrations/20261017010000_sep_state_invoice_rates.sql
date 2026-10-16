-- Sep 2026 all-state (non-bank, non-BFL) invoices: billing-only rate/day-basis alignment. Salaries untouched.
begin;
create table if not exists _bkp_sep_state_inv_rates_20261017 as select * from contract_resources where id in ('65f12c92-1025-427d-9abd-9a196cff5c5a','24900ce1-7bf3-4652-8641-097df714c0d7','8509782c-596d-41f6-81c7-20187c69cdae','25802bee-c3c5-4a6f-af64-702e98a2a9ab','d3e29ed2-e359-45b2-a5b6-cd473d74d161','e1ed5e35-8133-41bc-960e-95f5fe1166f9','e6e5d53f-0c86-49e1-99c2-d2e899bde003','c5b45f46-ba91-4011-a26c-de9e17c230c1','1dfd9e38-5dd5-49f2-96c2-8cff48b9f833','fb7bf669-232f-43e8-8ad3-06a20adf3ef7','8c95569b-bb8c-443e-8179-f1925793f7ce','3b9d1095-7c6e-4a33-9df2-dae3840f63dc','f3da1eed-ccfb-471b-8b46-cd720ee65675','f5e142ed-b6bb-4de5-9310-fc2d0a2f2037','06a67aab-660a-4b1b-9786-fab1a2816302','9c865b40-05cb-4856-8f2d-f104c2b19894','e0d2c0e7-c4cf-4250-8b49-32ec84aab2d4','18f490c5-f95d-422b-b163-dac698584a92','d1afb7f7-2f8a-42f2-925d-6df5f4a1f8a2','55bd68d9-9927-441d-b68f-1614d2532737','cf161050-0001-4001-8001-000000000001','cf161050-0001-4001-8001-000000000002','00b24f77-85bf-4ec8-8b6e-7b8d57afa783','c42dc93c-00d0-4cbc-ab91-5d0589825497','a8353501-dba1-40f1-b55d-e5e51718ab90','17ec7ba9-a796-4d98-a46c-806c8dbc4005','c1152110-0001-4001-8001-000000000004','c1152110-0001-4001-8001-000000000001','c1152100-0001-4001-8001-000000000004','c1152100-0001-4001-8001-000000000001','bd7b03c0-cadd-4487-a503-6a11e88446d0','24a9d2e4-45d1-4297-a61f-332c3ef1196f','cf143130-0001-4001-8001-000000000002','cf143130-0001-4001-8001-000000000001','b83424f5-fdf5-4291-86c4-3e1596efc649','69e0aee3-d141-4bab-b2a3-c8ba14495e28','5990e786-6dec-488a-be4b-8a84a9a1de56','2293c958-ca5e-4d70-9a75-6ba6de6171d4','386b9b36-2a93-47f7-9888-ce6d4954af14','17b315b2-6853-4ff3-9917-c5ff95c2b17f','ee359e34-48e3-41c0-aded-4c4ebe8e7890','ff5749a5-f505-4a7f-a582-c550c79bbd8d','83f86b59-3ae6-4d00-821c-511cdd9741a2','79100c2b-c4aa-4443-a75f-f4be3190a132','68c4a01e-9fcc-4111-9a78-06cb5585e0b7','ab952d3c-9142-4c86-9897-b726eb8e9a94','d80b7c4a-3102-4055-9c82-f03822600868','0c2e0321-3bba-4d10-a1e8-29065cfff55e','2af2df88-b1bf-4192-88f9-99429dd0a699','daeaedd0-ac2a-4305-9cc0-65be2a98012f','5f4a27b3-bac0-419b-be35-39bd787bf5e1','7bcb6fac-f358-4808-8e18-1b04595bdeb7','ab6ebb5a-58fc-4345-9417-527f29cdfd3e','add8562a-ae24-42ff-948e-6329f538827b','82ca6de5-611d-455f-9a30-b5bf8c3232fd','312bf663-53d3-4b37-898b-8297df55d73f','78831824-835b-485a-9929-6af4944851e7','d37e38d6-95b5-415d-87a2-14dc0f742416','f49fd485-64bd-40e3-b799-9f641430a62f','a83801f9-f803-4941-8d17-dbb8f5d8e46a','131f81fd-e06d-45f6-a98d-b4cd2c331b29','b5ab8863-f5a9-4789-a6f4-26b22bf67b12','c7e0a512-3b2f-4bb9-ba52-0070d22dbbcd','9bf30953-fb94-4580-b4af-defd47263fb2','ecf425c6-2989-4a9e-af57-fe8a9fa1ef08','5650b606-827f-4c64-94da-5da365bacd69','d6286180-68bf-4807-9e73-37a240202ea3','284ab1c3-1598-403f-9d6c-09847a76de2f','d03fe459-936a-48b8-8ae7-73b8616ac08f','02f1e6c1-41ca-4d46-adef-58fef4f2c5a7','76bb662f-7227-4d88-8272-5434552ec62f','8ed71c42-728a-4323-a964-af549864a319','c4a508a4-0de2-494a-a174-eb1ea8ed476b','5920cc49-0266-4ab4-affb-695f9b122f68','5f7dd722-e634-4988-86bc-7afd80b3096f','821363eb-2b03-4138-a05a-69d0b94d50eb','0d6dad4c-8c17-45e5-9b87-2d37efd6391e','7281fe46-f6eb-4e7e-94f9-76b74fac84dc','44c1b4c9-4060-41ac-ad7b-c24b537a07e6','c719032f-3b84-44e3-8cd8-466255d7f192','f9b38f50-8ae3-4474-b43e-5e66c7db5c66','ba1f8bda-bb96-4cb5-b9c8-58d3afc3dac5','a2328863-33d3-497d-97c1-d30e6a6e65f6','2d63fa41-4f58-4fbf-82c3-b0ffbc00683a','ac5c7035-896d-402e-bf2c-a193e6285c2a','46fe21ea-6146-440a-8fb0-014f21035365','8dc82467-7433-4d9e-8bdc-e22327993a83','9856c6bc-09fb-4e9f-a035-6df02786c762','d1b5fc34-d234-4493-bcc2-6ee3eda36ac7','29c09963-9f97-486f-9e61-041a32dec1d7','797645bd-455d-4002-85bf-de2a89f274f1','bb7ab5e8-209b-47db-b1fd-5bfc1f18eb06','e61364ec-96ab-4e56-87b5-00e266288d2a','14a79a79-af2e-41c7-bd2c-5a92ba881efb','205e577b-f34d-4354-bd58-4e9ef8258f2b','bc057d83-5ef8-4993-bc48-d88d86517e57','32117097-e27c-458b-abea-2eea17176e48','311e500a-0e01-4803-ab4a-fbaa238bc92c','135ad22e-3a17-448f-8d6a-83f97636e77e');
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GA-SEP26-27-0101)','state','N/A','amount',
   round(28017.39 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='65f12c92-1025-427d-9abd-9a196cff5c5a';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0668)','state','N/A','amount',
   round(32412.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='24900ce1-7bf3-4652-8641-097df714c0d7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0668)','state','N/A','amount',
   round(31642.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='8509782c-596d-41f6-81c7-20187c69cdae';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0669)','state','N/A','amount',
   round(31642.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='25802bee-c3c5-4a6f-af64-702e98a2a9ab';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0666)','state','N/A','amount',
   round(30521.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='d3e29ed2-e359-45b2-a5b6-cd473d74d161';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0666)','state','N/A','amount',
   round(28830.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='e1ed5e35-8133-41bc-960e-95f5fe1166f9';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0666)','state','N/A','amount',
   round(23336.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='e6e5d53f-0c86-49e1-99c2-d2e899bde003';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0667)','state','N/A','amount',
   round(30521.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='c5b45f46-ba91-4011-a26c-de9e17c230c1';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0667)','state','N/A','amount',
   round(28830.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='1dfd9e38-5dd5-49f2-96c2-8cff48b9f833';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0667)','state','N/A','amount',
   round(23336.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='fb7bf669-232f-43e8-8ad3-06a20adf3ef7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0804)','state','N/A','amount',
   round(33497.75 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='8c95569b-bb8c-443e-8179-f1925793f7ce';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0806)','state','N/A','amount',
   round(28811.44 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='3b9d1095-7c6e-4a33-9df2-dae3840f63dc';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0806)','state','N/A','amount',
   round(29044.32 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='f3da1eed-ccfb-471b-8b46-cd720ee65675';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0808)','state','N/A','amount',
   round(24677.97 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='f5e142ed-b6bb-4de5-9310-fc2d0a2f2037';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice GJ-SEP26-27-0808)','state','N/A','amount',
   round(24350.35 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='06a67aab-660a-4b1b-9786-fab1a2816302';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0411)','state','N/A','amount',
   round(21536.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='9c865b40-05cb-4856-8f2d-f104c2b19894';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0412)','state','N/A','amount',
   round(32413.83 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='e0d2c0e7-c4cf-4250-8b49-32ec84aab2d4';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0412)','state','N/A','amount',
   round(31894.16 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='18f490c5-f95d-422b-b163-dac698584a92';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0419)','state','N/A','amount',
   round(29209.5 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='d1afb7f7-2f8a-42f2-925d-6df5f4a1f8a2';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0415)','state','N/A','amount',
   round(37414.44 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='55bd68d9-9927-441d-b68f-1614d2532737';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0420)','state','N/A','amount',
   round(21617.7 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='cf161050-0001-4001-8001-000000000001';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice KA-SEP26-27-0420)','state','N/A','amount',
   round(21276.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='cf161050-0001-4001-8001-000000000002';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2916)','state','N/A','amount',
   round(33721.22 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='00b24f77-85bf-4ec8-8b6e-7b8d57afa783';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2916)','state','N/A','amount',
   round(33218.12 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='c42dc93c-00d0-4cbc-ab91-5d0589825497';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2922)','state','N/A','amount',
   round(23476.96 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='a8353501-dba1-40f1-b55d-e5e51718ab90';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2922)','state','N/A','amount',
   round(21784.36 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='17ec7ba9-a796-4d98-a46c-806c8dbc4005';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2926)','state','N/A','amount',
   round(33032.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='c1152110-0001-4001-8001-000000000004';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2926)','state','N/A','amount',
   round(30084.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='c1152110-0001-4001-8001-000000000001';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2927)','state','N/A','amount',
   round(33032.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='c1152100-0001-4001-8001-000000000004';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2927)','state','N/A','amount',
   round(30084.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_40'), updated_at=now() where r.id='c1152100-0001-4001-8001-000000000001';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2928)','state','N/A','amount',
   round(30473.82 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='bd7b03c0-cadd-4487-a503-6a11e88446d0';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2996)','state','N/A','amount',
   round(21056.57 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='24a9d2e4-45d1-4297-a61f-332c3ef1196f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2952)','state','N/A','amount',
   round(34096.59 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='cf143130-0001-4001-8001-000000000002';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2952)','state','N/A','amount',
   round(33063.16 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='cf143130-0001-4001-8001-000000000001';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2999)','state','N/A','amount',
   round(23797.5 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='b83424f5-fdf5-4291-86c4-3e1596efc649';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3001)','state','N/A','amount',
   round(28903.94 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='69e0aee3-d141-4bab-b2a3-c8ba14495e28';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3001)','state','N/A','amount',
   round(26015.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='5990e786-6dec-488a-be4b-8a84a9a1de56';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2945)','state','N/A','amount',
   round(31660.29 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='2293c958-ca5e-4d70-9a75-6ba6de6171d4';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3014)','state','N/A','amount',
   round(32888.39 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='386b9b36-2a93-47f7-9888-ce6d4954af14';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3014)','state','N/A','amount',
   round(31882.11 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='17b315b2-6853-4ff3-9917-c5ff95c2b17f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3015)','state','N/A','amount',
   round(31882.11 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='ee359e34-48e3-41c0-aded-4c4ebe8e7890';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3019)','state','N/A','amount',
   round(28993.5 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='ff5749a5-f505-4a7f-a582-c550c79bbd8d';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3025)','state','N/A','amount',
   round(36956.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='83f86b59-3ae6-4d00-821c-511cdd9741a2';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3021)','state','N/A','amount',
   round(26964.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='79100c2b-c4aa-4443-a75f-f4be3190a132';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3021)','state','N/A','amount',
   round(25410.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='68c4a01e-9fcc-4111-9a78-06cb5585e0b7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2951)','state','N/A','amount',
   round(19234.2 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='ab952d3c-9142-4c86-9897-b726eb8e9a94';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-2951)','state','N/A','amount',
   round(16357.2 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='d80b7c4a-3102-4055-9c82-f03822600868';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3054)','state','N/A','amount',
   round(24896.42 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='0c2e0321-3bba-4d10-a1e8-29065cfff55e';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3060)','state','N/A','amount',
   round(26023.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='2af2df88-b1bf-4192-88f9-99429dd0a699';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3060)','state','N/A','amount',
   round(24488.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='daeaedd0-ac2a-4305-9cc0-65be2a98012f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3070)','state','N/A','amount',
   round(25448.77 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='5f4a27b3-bac0-419b-be35-39bd787bf5e1';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3020)','state','N/A','amount',
   round(28624.57 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='7bcb6fac-f358-4808-8e18-1b04595bdeb7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3020)','state','N/A','amount',
   round(27177.11 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='ab6ebb5a-58fc-4345-9417-527f29cdfd3e';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3035)','state','N/A','amount',
   round(24004.67 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='add8562a-ae24-42ff-948e-6329f538827b';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3036)','state','N/A','amount',
   round(24004.67 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='82ca6de5-611d-455f-9a30-b5bf8c3232fd';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3044)','state','N/A','amount',
   round(29386.48 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='312bf663-53d3-4b37-898b-8297df55d73f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3048)','state','N/A','amount',
   round(42538.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='78831824-835b-485a-9929-6af4944851e7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3048)','state','N/A','amount',
   round(42159.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='d37e38d6-95b5-415d-87a2-14dc0f742416';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3056)','state','N/A','amount',
   round(24896.42 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='f49fd485-64bd-40e3-b799-9f641430a62f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3085)','state','N/A','amount',
   round(48151.5 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='a83801f9-f803-4941-8d17-dbb8f5d8e46a';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3090)','state','N/A','amount',
   round(30657.69 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='131f81fd-e06d-45f6-a98d-b4cd2c331b29';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3090)','state','N/A','amount',
   round(29254.77 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='b5ab8863-f5a9-4789-a6f4-26b22bf67b12';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3091)','state','N/A','amount',
   round(21040.94 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='c7e0a512-3b2f-4bb9-ba52-0070d22dbbcd';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3091)','state','N/A','amount',
   round(20042.05 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='9bf30953-fb94-4580-b4af-defd47263fb2';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3093)','state','N/A','amount',
   round(20500.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='ecf425c6-2989-4a9e-af57-fe8a9fa1ef08';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3096)','state','N/A','amount',
   round(27395.9 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='5650b606-827f-4c64-94da-5da365bacd69';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3052)','state','N/A','amount',
   round(16143.46 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='d6286180-68bf-4807-9e73-37a240202ea3';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3052)','state','N/A','amount',
   round(15241.04 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='284ab1c3-1598-403f-9d6c-09847a76de2f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3107)','state','N/A','amount',
   round(27237.18 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='d03fe459-936a-48b8-8ae7-73b8616ac08f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3128)','state','N/A','amount',
   round(35376.29 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='02f1e6c1-41ca-4d46-adef-58fef4f2c5a7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3130)','state','N/A','amount',
   round(30024.11 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='76bb662f-7227-4d88-8272-5434552ec62f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3130)','state','N/A','amount',
   round(28464.04 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='8ed71c42-728a-4323-a964-af549864a319';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3131)','state','N/A','amount',
   round(24969.6 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='c4a508a4-0de2-494a-a174-eb1ea8ed476b';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3131)','state','N/A','amount',
   round(23647.95 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='5920cc49-0266-4ab4-affb-695f9b122f68';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3126)','state','N/A','amount',
   round(37118.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='5f7dd722-e634-4988-86bc-7afd80b3096f';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3135)','state','N/A','amount',
   round(26902.98 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='821363eb-2b03-4138-a05a-69d0b94d50eb';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3136)','state','N/A','amount',
   round(28136.59 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='0d6dad4c-8c17-45e5-9b87-2d37efd6391e';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3140)','state','N/A','amount',
   round(30299.05 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='7281fe46-f6eb-4e7e-94f9-76b74fac84dc';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3142)','state','N/A','amount',
   round(35766.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='44c1b4c9-4060-41ac-ad7b-c24b537a07e6';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3045)','state','N/A','amount',
   round(28827.94 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_MINUS_SUNDAYS'), updated_at=now() where r.id='c719032f-3b84-44e3-8cd8-466255d7f192';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3240)','state','N/A','amount',
   round(23705.21 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='f9b38f50-8ae3-4474-b43e-5e66c7db5c66';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3281)','state','N/A','amount',
   round(40621.84 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='ba1f8bda-bb96-4cb5-b9c8-58d3afc3dac5';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3284)','state','N/A','amount',
   round(53286.49 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='a2328863-33d3-497d-97c1-d30e6a6e65f6';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3284)','state','N/A','amount',
   round(50818.48 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_30_42'), updated_at=now() where r.id='2d63fa41-4f58-4fbf-82c3-b0ffbc00683a';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3285)','state','N/A','amount',
   round(20440.54 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='ac5c7035-896d-402e-bf2c-a193e6285c2a';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3285)','state','N/A','amount',
   round(17074.47 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='DAYS_MINUS_4'), updated_at=now() where r.id='46fe21ea-6146-440a-8fb0-014f21035365';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3292)','state','N/A','amount',
   round(23679.76 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='8dc82467-7433-4d9e-8bdc-e22327993a83';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3288)','state','N/A','amount',
   round(29759.05 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='9856c6bc-09fb-4e9f-a035-6df02786c762';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3288)','state','N/A','amount',
   round(28332.61 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='d1b5fc34-d234-4493-bcc2-6ee3eda36ac7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3290)','state','N/A','amount',
   round(31610.1 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='29c09963-9f97-486f-9e61-041a32dec1d7';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3311)','state','N/A','amount',
   round(26459.47 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='797645bd-455d-4002-85bf-de2a89f274f1';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3311)','state','N/A','amount',
   round(24063.02 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='bb7ab5e8-209b-47db-b1fd-5bfc1f18eb06';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3312)','state','N/A','amount',
   round(22116.48 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='FIXED_26'), updated_at=now() where r.id='e61364ec-96ab-4e56-87b5-00e266288d2a';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3243)','state','N/A','amount',
   round(14187.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='14a79a79-af2e-41c7-bd2c-5a92ba881efb';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3244)','state','N/A','amount',
   round(358427.22 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='205e577b-f34d-4354-bd58-4e9ef8258f2b';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3249)','state','N/A','amount',
   round(91672.36 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='bc057d83-5ef8-4993-bc48-d88d86517e57';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3257)','state','N/A','amount',
   round(328011.2 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='32117097-e27c-458b-abea-2eea17176e48';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3265)','state','N/A','amount',
   round(211315.19 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='311e500a-0e01-4803-ab4a-fbaa238bc92c';
update contract_resources r set employer_contributions =
 (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%')
 || jsonb_build_array(jsonb_build_object('name','Billing Rate Adjustment (as per client invoice MH-SEP26-27-3317)','state','N/A','amount',
   round(46190.0 - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.components) x)
     - (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(coalesce(r.employer_contributions,'[]')) x where x->>'name' not like 'Billing Rate Adjustment%'),2),
   'calcType','fixed','capAmount',null,'percentage',0,'formulaMode','preset','capFlatAmount',null,'baseComponents','[]'::jsonb,'formulaVersion',1,'costComponentId',null,'fixedCalcMethod','flat','fixedDutyDivisor',null,'deductionCalcType','fixed_amount','formulaExpression',null,'fixedDutyComponents','[]'::jsonb)),
 billing_day_base_id=(select id from billing_day_bases where code='ACTUAL_DAYS'), updated_at=now() where r.id='135ad22e-3a17-448f-8d6a-83f97636e77e';
commit;
