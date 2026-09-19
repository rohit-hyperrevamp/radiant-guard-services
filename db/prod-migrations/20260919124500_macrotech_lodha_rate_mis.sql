-- Macrotech Developers Ltd (Lodha) rate MIS reconciliation
-- Source: Macrotech_Developers_Ltd_Lodha_Rate_MIS_4.xlsx
-- CON16022..CON16026 : add missing "Lady Facility Attendant" 8 Hrs line
-- CON16130           : replace Security Guard line with Facility Attendant 12 Hrs + Lady Facility Attendant 8 Hrs

begin;

insert into designations (name, code, enabled, billable)
select 'Lady Facility Attendant', 'LFA', true, true
where not exists (select 1 from designations where lower(name) = 'lady facility attendant');

-- CON16130: drop the incorrect Security Guard resource line
delete from contract_resources cr
using client_contracts cc
where cc.id = cr.contract_id and cc.contract_code = 'CON16130';

-- CON16130: Facility Attendant 12 Hrs (matches the other Lodha sites)
insert into contract_resources (
  contract_id, designation_id, service_type_id, payroll_day_base_id, billing_day_base_id,
  quantity, shift_hours, sort_order, gross, components, deductions, employer_contributions, benefits)
select cc.id,
  (select id from designations where name = 'Facility Attendant'),
  'b10a1dd8-116e-4c1d-856e-4b3785c04bd1'::uuid,
  '81d084a0-8d1c-4259-9b46-1fadab8c0cb7'::uuid,
  '705b6d41-bc63-4500-9acd-7f0320273e3e'::uuid,
  1, 12, 1, 25262.46,
  (select components from contract_resources r join client_contracts c2 on c2.id = r.contract_id
     where c2.contract_code = 'CON16022' and r.shift_hours = 12 limit 1),
  (select deductions from contract_resources r join client_contracts c2 on c2.id = r.contract_id
     where c2.contract_code = 'CON16022' and r.shift_hours = 12 limit 1),
  (select employer_contributions from contract_resources r join client_contracts c2 on c2.id = r.contract_id
     where c2.contract_code = 'CON16022' and r.shift_hours = 12 limit 1),
  '[]'::jsonb
from client_contracts cc
where cc.contract_code = 'CON16130';

-- Lady Facility Attendant 8 Hrs for all six Lodha contracts
insert into contract_resources (
  contract_id, designation_id, service_type_id, payroll_day_base_id, billing_day_base_id,
  quantity, shift_hours, sort_order, gross, components, deductions, employer_contributions, benefits)
select cc.id,
  (select id from designations where name = 'Lady Facility Attendant'),
  'b10a1dd8-116e-4c1d-856e-4b3785c04bd1'::uuid,
  case when cc.contract_code = 'CON16130'
       then '81d084a0-8d1c-4259-9b46-1fadab8c0cb7'::uuid
       else 'e23708c1-250e-4440-b76d-1c2c63a99218'::uuid end,
  case when cc.contract_code = 'CON16130'
       then '705b6d41-bc63-4500-9acd-7f0320273e3e'::uuid
       else 'c82178db-3864-471f-b078-1510ea49a2f9'::uuid end,
  1, 8, 2, 17656.03,
  '[
    {"name":"Basic","amount":10021,"allowanceId":"44e4177f-b612-44ac-9b4b-227da493a4c9","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
    {"name":"DA","amount":3900,"allowanceId":"4ac31d78-dafd-44d2-9123-2168ce28917a","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
    {"name":"HRA 10% (Basic+DA)","amount":1392.10,"allowanceId":"aa101120-0001-4001-8001-000000000001","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
    {"name":"Leave with Wages 4% (Basic+DA)","amount":556.84,"allowanceId":"aa161330-0001-4001-8001-000000000004","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
    {"name":"Paid Holiday 1% (Basic+DA)","amount":139.21,"allowanceId":"10b07374-0106-40c2-9b83-dfa9881c9989","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
    {"name":"Uniform Allowance","amount":300,"allowanceId":"92303274-cd77-4692-b956-4c96622da5b1","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
    {"name":"Washing Allowance","amount":187.26,"allowanceId":"9a96de53-a582-4f5a-a8de-bb349335cb47","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
    {"name":"Bonus / Exgratia 8.33% (Basic+DA) Exact","amount":1159.62,"allowanceId":"aa152100-0001-4001-8001-000000000002","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null}
  ]'::jsonb,
  '[
    {"name":"EE EPF 12% (Gross-HRA, cap 15000)","state":"N/A","amount":1800,"calcType":"percentage","capAmount":null,"percentage":12,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc113290-0001-4001-8001-000000000001","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":"min(gross - hra, 15000) * 0.12","fixedDutyComponents":[]},
    {"name":"EE Professional Tax","state":"Maharashtra","amount":200,"calcType":"fixed","capAmount":null,"percentage":0.0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"70113912-2bb8-4916-b1d5-84d090a387e0","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"fixed_amount","formulaExpression":null,"fixedDutyComponents":[]},
    {"name":"EE ESI 0.75% (Basic+DA)","state":"N/A","amount":104.41,"calcType":"percentage","capAmount":null,"percentage":0.75,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc161330-0001-4001-8001-000000000001","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":"(basic + da) * 0.0075","fixedDutyComponents":[]}
  ]'::jsonb,
  '[
    {"name":"ER EPF 13% (Gross-HRA, cap 15000)","state":"N/A","amount":1950,"calcType":"percentage","capAmount":null,"percentage":13,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc113290-0001-4001-8001-000000000002","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":"min(gross - hra, 15000) * 0.13","fixedDutyComponents":[]},
    {"name":"ER ESI 3.25% (Basic+DA)","state":"N/A","amount":452.43,"calcType":"percentage","capAmount":null,"percentage":3.25,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc161330-0001-4001-8001-000000000002","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":"(basic + da) * 0.0325","fixedDutyComponents":[]},
    {"name":"ER LWF - MH","state":"Maharashtra","amount":12.5,"calcType":"fixed","capAmount":null,"percentage":0.0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"70421294-a437-4e27-a0bd-5585513b8039","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"fixed_amount","formulaExpression":null,"fixedDutyComponents":[]},
    {"name":"Gratuity 4.81% (Basic+DA)","state":"N/A","amount":0.0,"calcType":"fixed","capAmount":null,"percentage":4.81,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc161170-0001-4001-8001-000000000002","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","fixedDutyComponents":[]},
    {"name":"Management Fees (Fixed)","state":"N/A","amount":1159.04,"calcType":"fixed","capAmount":null,"percentage":0.0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc900000-0001-4001-8001-000000000003","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"fixed_amount","formulaExpression":null,"fixedDutyComponents":[]}
  ]'::jsonb,
  '[]'::jsonb
from client_contracts cc
where cc.contract_code in ('CON16022','CON16023','CON16024','CON16025','CON16026','CON16130')
  and not exists (
    select 1 from contract_resources r
    where r.contract_id = cc.id and r.shift_hours = 8
      and r.designation_id = (select id from designations where name = 'Lady Facility Attendant'));

commit;
