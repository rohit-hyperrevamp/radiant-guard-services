-- contracts_1.xlsx: fill missing contract IDs. TEMP-0001 (CLI1733) -> CON16175; create 9 L&T Finance sites
-- from Ankita's sheet (CLI4544-4551, CLI4556) with contracts CON16226-16234, cloned from the
-- matching state's existing L&T Security Guard line (Karnataka CON16223 SG, Gujarat CON15256).
begin;
update client_contracts set contract_code='CON16175', start_date='2026-08-01', original_start_date='2026-08-01',
 end_date='2026-12-31', expiry_date='2026-12-31', updated_at=now() where contract_code='TEMP-0001';
create temp table nl(code text,name text,city text,con text,st date,en date,tu text,tc text) on commit drop;
insert into nl values
('CLI4544','L&T FINANCE LTD- BAGALKOT GL-(D378)','Bagalkot','CON16226','2026-08-21','2027-09-20','CLI4506','CON16223'),
('CLI4545','L&T FINANCE LTD- NEHRU GUNJ KALABURGI GL-(D417)','Kalaburagi','CON16227','2026-08-21','2026-12-31','CLI4506','CON16223'),
('CLI4546','L&T FINANCE LTD- CHIKABALLAPURA H-CROSS GL','Chikkaballapura','CON16233','2026-08-21','2026-12-20','CLI4506','CON16223'),
('CLI4547','L&T FINANCE LTD- KOLAR GL','Kolar','CON16234','2026-08-21','2026-12-20','CLI4506','CON16223'),
('CLI4548','L&T FINANCE LTD- MANSA-(D353)','Mansa','CON16228','2026-08-21','2026-12-20','CLI4224','CON15256'),
('CLI4549','L&T FINANCE LTD - BHARUCH','Bharuch','CON16229','2026-08-21','2026-12-21','CLI4224','CON15256'),
('CLI4550','L&T FINANCE LTD- DHRANGADARA','Dhrangadhra','CON16230','2026-08-21','2026-12-20','CLI4224','CON15256'),
('CLI4551','L&T FINANCE LTD- BALASINOR','Balasinor','CON16231','2026-08-21','2026-12-20','CLI4224','CON15256'),
('CLI4556','L&T FINANCE LIMITED- MANDVI','Mandvi','CON16232','2026-08-21','2026-12-20','CLI4224','CON15256');
insert into units select (jsonb_populate_record(null::units, to_jsonb(t.*)||jsonb_build_object('id',gen_random_uuid(),'code',nl.code,'name',nl.name,'location',nl.city,'client_city',nl.city,'shipping_city',nl.city,'latitude',null,'longitude',null,'coordinates_source',null,'coordinates_captured_by',null,'coordinates_captured_at',null,'coordinates_accuracy_m',null,'branch_sap_code',null,'contract_start_date',nl.st,'contract_end_date',nl.en,'onboarding_date',nl.st,'account_manager_id',(select id from candidates where employee_code='45007'),'created_at',now(),'updated_at',now()))).*
from nl join units t on t.code=nl.tu where not exists(select 1 from units x where x.code=nl.code);
insert into client_contracts select (jsonb_populate_record(null::client_contracts, to_jsonb(t.*)||jsonb_build_object('id',gen_random_uuid(),'contract_code',nl.con,'unit_id',u.id,'start_date',nl.st,'original_start_date',nl.st,'end_date',nl.en,'expiry_date',nl.en,'renewal_count',0,'status','active','approval_status','approved','approved_at',now(),'payroll_window_id','9676d05d-fbb3-4d9a-bdca-b4b9ac65db0c','description',nl.name||' - '||nl.code,'created_at',now(),'updated_at',now()))).*
from nl join units u on u.code=nl.code join client_contracts t on t.contract_code=nl.tc where not exists(select 1 from client_contracts x where x.contract_code=nl.con);
insert into contract_resources select (jsonb_populate_record(null::contract_resources, to_jsonb(cr.*)||jsonb_build_object('id',gen_random_uuid(),'contract_id',c.id,'quantity',1,'sort_order',1,'created_at',now(),'updated_at',now()))).*
from nl join client_contracts c on c.contract_code=nl.con join client_contracts t on t.contract_code=nl.tc
join contract_resources cr on cr.contract_id=t.id and round(cr.gross::numeric,2) in (25869.65,20510.45)
where not exists(select 1 from contract_resources x where x.contract_id=c.id);
commit;
