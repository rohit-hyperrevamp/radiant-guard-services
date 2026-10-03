-- L&T Finance Telangana sites from Ankita's (45007) sheet that existed in the contract list
-- (CON16202–CON16216) but had never been created as client sites. Sites and contracts are cloned
-- from the standard L&T Telangana structure (CLI4448 / CON16140, gross 22,574.01, 1 guard).
-- Dates per contract list: 21 May 2026 – 20 Dec 2026 (not expired).
begin;
create temp table nl(code text, name text, city text, con text, fo text, ankita boolean) on commit drop;
insert into nl values
 ('CLI4509','L&T FINANCE LTD- INDIRANAGAR GL-(D401)','Indiranagar','CON16202','30044',true),
 ('CLI4513','L&T FINANCE LTD- KASHIBUGGA-(D398)','Kashibugga','CON16203','30044',true),
 ('CLI4514','L&T FINANCE LTD- HUSNABAD-(D446)','Husnabad','CON16204','30044',true),
 ('CLI4515','L&T FINANCE LTD- KHAIRATABAD-(D445)','Khairatabad','CON16205','37727',true),
 ('CLI4516','L&T FINANCE LTD- TURKAYAMJAL-(D479)','Turkayamjal','CON16206','37727',true),
 ('CLI4517','L&T FINANCE LTD- MALKAJGIRI-(D215)','Malkajgiri','CON16207','37727',true),
 ('CLI4518','L&T FINANCE LTD- NAGARAM-(D447)','Nagaram','CON16208','37727',true),
 ('CLI4519','L&T FINANCE LTD- BALAJI NAGAR-(D519)','Balaji Nagar','CON16209','37727',true),
 ('CLI4520','L&T FINANCE LTD- MAHABUBABAD-(D538)','Mahabubabad','CON16210','30044',true),
 ('CLI4521','L&T FINANCE LTD- MULUGU-(D542)','Mulugu','CON16211','37727',true),
 ('CLI4522','L&T FINANCE LTD- MANIKONDA-(D540)','Manikonda','CON16212','30044',true),
 ('CLI4524','L&T FINANCE LTD- AS RAO NAGAR - SAKET ROAD-(D070)','AS Rao Nagar','CON16213','37727',true),
 ('CLI4525','L&T FINANCE LTD- NARSAMPET-(D589)','Narsampet','CON16214',null,false),
 ('CLI4528','L&T FINANCE LTD- MEHBOOBNAGAR-(D629)','Mehboobnagar','CON16215','37378',true),
 ('CLI4529','L&T FINANCE LTD- LB NAGAR-(D612)','LB Nagar','CON16216','30044',true);

create temp table tu on commit drop as select * from public.units where code='CLI4448';
create temp table tc on commit drop as select * from public.client_contracts where contract_code='CON16140';

insert into public.units
select (jsonb_populate_record(null::public.units, to_jsonb(tu.*) || jsonb_build_object(
  'id', gen_random_uuid(), 'code', nl.code, 'name', nl.name, 'location', nl.city,
  'client_city', nl.city, 'shipping_city', nl.city, 'latitude', null, 'longitude', null,
  'coordinates_source', null, 'coordinates_captured_by', null, 'coordinates_captured_at', null,
  'coordinates_accuracy_m', null, 'branch_sap_code', null,
  'contract_start_date', '2026-05-21', 'contract_end_date', '2026-12-20', 'onboarding_date', '2026-05-21',
  'account_manager_id', case when nl.ankita then (select id from public.candidates where employee_code='45007') end,
  'created_at', now(), 'updated_at', now()))).*
from nl, tu
where not exists (select 1 from public.units x where x.code = nl.code);

insert into public.client_contracts
select (jsonb_populate_record(null::public.client_contracts, to_jsonb(tc.*) || jsonb_build_object(
  'id', gen_random_uuid(), 'contract_code', nl.con, 'unit_id', u.id,
  'start_date', '2026-05-21', 'end_date', '2026-12-20', 'expiry_date', '2026-12-20',
  'original_start_date', '2026-05-21', 'renewal_count', 0, 'approved_at', now(),
  'description', nl.name||' - '||nl.code,
  'created_at', now(), 'updated_at', now()))).*
from nl join public.units u on u.code = nl.code, tc
where not exists (select 1 from public.client_contracts x where x.contract_code = nl.con);

insert into public.contract_resources
select (jsonb_populate_record(null::public.contract_resources, to_jsonb(cr.*) || jsonb_build_object(
  'id', gen_random_uuid(), 'contract_id', c.id, 'created_at', now(), 'updated_at', now()))).*
from nl join public.client_contracts c on c.contract_code = nl.con
join public.contract_resources cr on cr.contract_id = (select id from tc)
where not exists (select 1 from public.contract_resources x where x.contract_id = c.id);

insert into public.employee_scope_assignments (candidate_id, scope_type, scope_id, scope_label)
select c.id, 'unit', u.id::text, u.code||' - '||u.name
from nl join public.units u on u.code = nl.code join public.candidates c on c.employee_code = nl.fo
where not exists (select 1 from public.employee_scope_assignments s
  where s.candidate_id = c.id and s.scope_type = 'unit' and s.scope_id = u.id::text);
commit;
