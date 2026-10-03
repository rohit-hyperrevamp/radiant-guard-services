-- Knauf Ceiling Solutions Bhiwandi (CLI3656) CON15866 from signed rate sheet (revised 01.01.2026-30.06.2026).
-- Security Guard, 8 hrs, 26 payable days, billing for 30/31 days ₹40,621.84. Contract list: 01 May 2026 - 31 Oct 2026, 1-31 window.
do $$
declare
  sc client_contracts; u_id uuid; c_id uuid := gen_random_uuid();
  f jsonb := '{"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"formulaExpression":null,"includeInOt":true}';
  d jsonb := '{"state":"N/A","calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"fixed_amount","formulaExpression":null,"fixedDutyComponents":[]}';
begin
  if exists (select 1 from client_contracts where contract_code = 'CON15866') then return; end if;
  select id into u_id from units where code = 'CLI3656';
  select * into sc from client_contracts where contract_code = 'CON15223';
  insert into client_contracts select * from jsonb_populate_record(null::client_contracts, to_jsonb(sc) || jsonb_build_object(
    'id', c_id, 'contract_code', 'CON15866', 'unit_id', u_id,
    'description', 'KNAUF CEILING SOLUTIONS BHIWANDI (MUMBAI) - CLI3656, Security Guard 8 Hrs 26 Days (rate sheet 01/01/2026, billing ₹40,621.84)',
    'payroll_window_id', '9676d05d-fbb3-4d9a-bdca-b4b9ac65db0c',
    'start_date', '2026-05-01', 'original_start_date', '2026-05-01',
    'end_date', '2026-10-31', 'expiry_date', '2026-10-31',
    'status', 'active', 'approval_status', 'approved', 'approved_at', now(),
    'signed_pdf_url', '', 'signed_at', null, 'renewal_count', 0, 'created_at', now(), 'updated_at', now()));
  insert into contract_resources (id, contract_id, designation_id, service_type_id, quantity, shift_hours, sort_order,
    payroll_day_base_id, billing_day_base_id, gross, benefits, components, deductions, employer_contributions)
  values (gen_random_uuid(), c_id, 'aad77ba7-98d2-44cb-a0f1-b598eed740f4', sc.service_type_id, 1, 8, 1,
    'fe52c7ac-4cfd-4de2-924f-56c69dfb2d96', 'abea52aa-6151-4d0a-9209-f102d3ecf226', 24328.40, '[]',
    jsonb_build_array(
      f || '{"name":"Basic","amount":13457,"allowanceId":"44e4177f-b612-44ac-9b4b-227da493a4c9"}',
      f || '{"name":"DA","amount":3900,"allowanceId":"4ac31d78-dafd-44d2-9123-2168ce28917a"}',
      f || '{"name":"HRA 20%","amount":3471.40,"allowanceId":null}',
      f || '{"name":"Conveyance Allowance","amount":2200,"allowanceId":null}',
      f || '{"name":"Washing Allowance","amount":1200,"allowanceId":null}',
      f || '{"name":"L.T.A.","amount":100,"allowanceId":null}'),
    jsonb_build_array(
      d || '{"name":"EE EPF 12% (Gross - HRA)","amount":1800,"costComponentId":null}',
      d || '{"name":"EE ESI 0.75%","amount":130.18,"costComponentId":"cc161330-0001-4001-8001-000000000001"}',
      d || '{"name":"EE Professional Tax","amount":200,"costComponentId":"70113912-2bb8-4916-b1d5-84d090a387e0"}'),
    jsonb_build_array(
      d || '{"name":"ER EPF 13% (Total B - HRA)","amount":1950,"costComponentId":null}',
      d || '{"name":"ER ESI 3.25%","amount":564.10,"costComponentId":"cc161330-0001-4001-8001-000000000002"}',
      d || '{"name":"Bonus 8.33% (Total A)","amount":1445.84,"costComponentId":null}',
      d || '{"name":"Leave with Wages 6% (Total A)","amount":1041.42,"costComponentId":null}',
      d || '{"name":"National Holiday 1% (Total A)","amount":173.57,"costComponentId":null}',
      d || '{"name":"Uniform Allowance 4.5%","amount":781.07,"costComponentId":null}',
      d || '{"name":"Gratuity 4.81% (Total A)","amount":834.87,"costComponentId":"cc143130-0001-4001-8001-000000000001"}',
      d || '{"name":"ER LWF - MH","amount":12.50,"costComponentId":"70421294-a437-4e27-a0bd-5585513b8039"}',
      d || '{"name":"Guard Board Levy 3%","amount":520.71,"costComponentId":null}',
      d || '{"name":"Reliever Charges @ 16.67%","amount":5276.47,"costComponentId":null}',
      d || '{"name":"Management Fees 10%","amount":3692.89,"costComponentId":"611a7658-810f-4aa5-a052-51aaa78a68cf"}'));
end $$;
