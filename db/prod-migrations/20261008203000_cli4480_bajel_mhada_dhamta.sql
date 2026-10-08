-- CLI4480 Bajel Mhada Dhamta Kalyan: site cloned from Bajel Beed (CLI3474), contract CON16194 on 1-31 window with Bajel rate card.
do $$ declare src units; u_id uuid; sc client_contracts; c_id uuid; begin
if not exists(select 1 from units where code='CLI4480') then
 select * into src from units where code='CLI3474'; u_id:=gen_random_uuid();
 insert into units select * from jsonb_populate_record(null::units, to_jsonb(src)||jsonb_build_object('id',u_id,'code','CLI4480','name','BAJEL PROJECTS LIMITED (MHADA DHAMTA, KALYAN)','status','active','created_at',now(),'updated_at',now()));
else select id into u_id from units where code='CLI4480'; end if;
if not exists(select 1 from client_contracts where contract_code='CON16194') then
 select * into sc from client_contracts where contract_code='CON14896'; c_id:=gen_random_uuid();
 insert into client_contracts select * from jsonb_populate_record(null::client_contracts, to_jsonb(sc)||jsonb_build_object('id',c_id,'contract_code','CON16194','unit_id',u_id,'description','BAJEL PROJECTS LIMITED (MHADA DHAMTA, KALYAN) - CLI4480, rate card RATE 1 TO 31_5','payroll_window_id','9676d05d-fbb3-4d9a-bdca-b4b9ac65db0c','start_date','2026-08-15','original_start_date','2026-08-15','end_date','2027-03-31','expiry_date','2027-03-31','status','active','approval_status','approved','approved_at',now(),'signed_pdf_url','','signed_at',null,'renewal_count',0,'created_at',now(),'updated_at',now()));
 insert into contract_resources(id,contract_id,designation_id,service_type_id,quantity,shift_hours,sort_order,payroll_day_base_id,billing_day_base_id,gross,benefits,components,deductions,employer_contributions,role_key)
 select gen_random_uuid(),c_id,designation_id,service_type_id,quantity,shift_hours,sort_order,payroll_day_base_id,billing_day_base_id,gross,benefits,components,deductions,employer_contributions,role_key from contract_resources where contract_id=sc.id;
end if; end $$;
