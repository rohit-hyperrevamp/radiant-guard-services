-- CLI289 Bag Electronics & Technology: create contract from client paysheet
-- (Security Guard, 8 hrs, 26 days; total billing 20,944 per guard).
do $$
declare
  src client_contracts;
  u_id uuid;
  c_id uuid := gen_random_uuid();
  next_num int;
begin
  select id into u_id from units where code = 'CLI289';
  if exists (select 1 from client_contracts where unit_id = u_id and status = 'active') then return; end if;
  select * into src from client_contracts where contract_code = 'CON13041';
  select coalesce(max((regexp_replace(contract_code, '\D', '', 'g'))::int), 0) into next_num
    from client_contracts where contract_code ~ '^CON[0-9]+$';

  insert into client_contracts
  select * from jsonb_populate_record(null::client_contracts, to_jsonb(src) || jsonb_build_object(
    'id', c_id, 'contract_code', 'CON' || (next_num + 1), 'unit_id', u_id,
    'description', 'BAG ELECTRONICS - CLI289, Security Guard 8 Hours',
    'start_date', '2024-07-01', 'original_start_date', '2024-07-01', 'end_date', null, 'expiry_date', null,
    'payroll_window_id', '9676d05d-fbb3-4d9a-bdca-b4b9ac65db0c',
    'status', 'active', 'approval_status', 'approved', 'approved_at', now(), 'record_type', 'client',
    'signed_pdf_url', '', 'signed_at', null, 'renewal_count', 0,
    'created_at', now(), 'updated_at', now()));

  insert into contract_resources (contract_id, designation_id, service_type_id, quantity, role_key, shift_hours,
    payroll_day_base_id, billing_day_base_id, gross, sort_order, components, benefits, deductions, employer_contributions)
  values (c_id, 'aad77ba7-98d2-44cb-a0f1-b598eed740f4', src.service_type_id, 1, 'guard', 8,
    'fe52c7ac-4cfd-4de2-924f-56c69dfb2d96', 'abea52aa-6151-4d0a-9209-f102d3ecf226', 16975.35, 0,
    $j$[
     {"name":"Basic","amount":12795.12,"allowanceId":"44e4177f-b612-44ac-9b4b-227da493a4c9","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
     {"name":"Special Allowance","amount":1736.02,"allowanceId":"b545cbf0-30c0-4e2a-87d0-b355fe8cc436","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
     {"name":"HRA 5% (Basic+DA)","amount":726.56,"allowanceId":"aa161330-0001-4001-8001-000000000003","formulaMode":"advanced","includeInOt":true,"formulaVersion":1,"formulaExpression":"(basic + special_allowance) * 0.05"},
     {"name":"Uniform Allowance 3% (Basic+DA)","amount":435.93,"allowanceId":"0e797c9f-f1d1-494e-83dc-5c2a670d42b0","formulaMode":"advanced","includeInOt":true,"formulaVersion":1,"formulaExpression":"(basic + special_allowance) * 0.03"},
     {"name":"Bonus / Exgratia 8.33% (Rs.7000)","amount":583.10,"allowanceId":"aa142900-0001-4001-8001-000000000001","formulaMode":"advanced","includeInOt":true,"formulaVersion":1,"formulaExpression":"7000 * 0.0833"},
     {"name":"Earned Leave 1.25 Days (Basic+DA)","amount":698.62,"allowanceId":"aa142900-0001-4001-8001-000000000002","formulaMode":"advanced","includeInOt":true,"formulaVersion":1,"formulaExpression":"(basic + special_allowance) / 26 * 1.25"}
    ]$j$::jsonb, '[]'::jsonb,
    $j$[
     {"name":"EE EPF 12% (Basic+DA, cap 15000)","state":"N/A","amount":1743.74,"calcType":"percentage","percentage":12,"formulaMode":"advanced","formulaVersion":1,"costComponentId":"cc159000-0001-4001-8001-000000000001","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"min(basic + special_allowance, 15000) * 0.12","baseComponents":[],"fixedDutyComponents":[]},
     {"name":"EE Professional Tax","state":"N/A","amount":200,"calcType":"fixed","percentage":0,"formulaMode":"preset","formulaVersion":1,"costComponentId":"70113912-2bb8-4916-b1d5-84d090a387e0","fixedCalcMethod":"flat","deductionCalcType":"earned_salary","formulaExpression":null,"baseComponents":[],"fixedDutyComponents":[]},
     {"name":"EE ESI 0.75% (Gross)","state":"N/A","amount":127.32,"calcType":"percentage","percentage":0,"formulaMode":"advanced","formulaVersion":1,"costComponentId":"cc152370-0001-4001-8001-000000000003","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"gross * 0.0075","baseComponents":[],"fixedDutyComponents":[]}
    ]$j$::jsonb,
    $j$[
     {"name":"ER EPF 13% (Basic+DA+Special Allowances)","state":"N/A","amount":1889.05,"calcType":"percentage","percentage":13,"formulaMode":"advanced","formulaVersion":1,"costComponentId":"cc152100-0001-4001-8001-000000000002","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"min(basic + special_allowance, 15000) * 0.13","baseComponents":[],"fixedDutyComponents":[]},
     {"name":"ER ESI Contribution","state":"N/A","amount":510,"calcType":"fixed","percentage":0,"formulaMode":"preset","formulaVersion":1,"costComponentId":"d6f05906-bd8c-4491-bdee-b83847fad0b7","fixedCalcMethod":"flat","deductionCalcType":"earned_salary","formulaExpression":null,"baseComponents":[],"fixedDutyComponents":[]},
     {"name":"Service Charge","state":"Custom fixed amount","amount":1569.60,"calcType":"fixed","percentage":0,"formulaMode":null,"formulaVersion":null,"costComponentId":"__custom_management_fee__","formulaExpression":null,"baseComponents":[]}
    ]$j$::jsonb);
end $$;
