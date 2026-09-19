-- Kids Clinic India Ltd Nerul (CLI3982) — new contract CON14141, Patient Guide rate card
-- Source: Kids_Clinic_India_Ltd_Nerul_Rate_MIS.xlsx (period 21-Dec-2025 to 20-May-2027, 21-20 window)
BEGIN;

INSERT INTO client_contracts (
  contract_code, unit_id, start_date, end_date, description,
  service_type_id, payroll_window_id, billing_type_id, gst_option,
  status, approval_status, approved_at, record_type
)
VALUES (
  'CON14141',
  '038605f3-0643-4a2a-a16d-156b77a3bd21', -- CLI3982 KIDS CLINIC INDIA LTD NERUL
  '2025-12-21', '2027-05-20',
  'Kids Clinic India Ltd Nerul — Patient Guide rate card',
  'ccaa3103-1067-4678-8ec3-7c16949ea456',
  '5e900b36-3cca-4137-a923-57bfe7910641', -- 21-20 payroll window
  '70f409c8-2eb6-4b44-bbae-2fe15a566b6d', -- Man Days
  'csgst',
  'active', 'approved', now(), 'client'
);

INSERT INTO contract_resources (
  contract_id, designation_id, service_type_id, quantity, components, gross,
  sort_order, payroll_day_base_id, benefits, deductions, employer_contributions,
  role_key, shift_hours, billing_day_base_id
)
SELECT
  cc.id,
  'cca370d6-c707-4e7e-94f1-ccce240b5139', -- Patient Guide
  'ccaa3103-1067-4678-8ec3-7c16949ea456',
  1,
  '[
    {"name":"Basic","amount":15475,"allowanceId":"44e4177f-b612-44ac-9b4b-227da493a4c9","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
    {"name":"DA","amount":420,"allowanceId":"4ac31d78-dafd-44d2-9123-2168ce28917a","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
    {"name":"HRA 10% (Basic+DA)","amount":1590,"allowanceId":"aa101120-0001-4001-8001-000000000001","formulaMode":"advanced","includeInOt":true,"formulaVersion":1,"formulaExpression":"(basic + da) * 0.10"},
    {"name":"Earnings Leave","amount":1325,"allowanceId":"600dd5d1-40e2-417a-9749-7e0dbdc9d872","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
    {"name":"Bonus / Exgratia 8.33% (Basic+DA)","amount":1324,"allowanceId":"ff6bc38b-c7e9-4c2c-aae8-9e2450781e49","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":"{\"base\":{\"kind\":\"composite\",\"components\":[{\"name\":\"Basic\",\"operator\":\"+\"},{\"name\":\"DA\",\"operator\":\"+\"}]},\"operator\":\"percent\",\"percent\":8.33,\"capAmount\":null,\"floorAmount\":null,\"multipliers\":[]}"}
  ]'::jsonb,
  20134,
  0,
  'e23708c1-250e-4440-b76d-1c2c63a99218', -- Actual Days in Month (30-day pattern)
  '[]'::jsonb,
  '[
    {"name":"EE Professional Tax","state":"N/A","amount":200,"calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"70113912-2bb8-4916-b1d5-84d090a387e0","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":null,"fixedDutyComponents":[]},
    {"name":"EE EPF 12% (Basic+DA, cap 15000)","state":"N/A","amount":1800,"calcType":"percentage","capAmount":null,"percentage":12,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[{"label":"Basic","operator":"+"},{"label":"DA","operator":"+"}],"formulaVersion":1,"costComponentId":"cc159000-0001-4001-8001-000000000001","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"min(basic + da, 15000) * 0.12","fixedDutyComponents":[]},
    {"name":"EE ESI Contribution","state":"N/A","amount":119.21,"calcType":"percentage","capAmount":null,"percentage":0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":3,"costComponentId":"4c67a437-7b8f-4dcb-a087-59b23a5b305e","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"{\"base\":{\"kind\":\"composite\",\"components\":[{\"name\":\"Basic\",\"operator\":\"+\"},{\"name\":\"DA\",\"operator\":\"+\"}]},\"operator\":\"percent\",\"percent\":0.75,\"capAmount\":21000,\"floorAmount\":null,\"multipliers\":[]}","fixedDutyComponents":[]}
  ]'::jsonb,
  '[
    {"name":"ER EPF 13% (Basic+DA, cap 15000)","state":"N/A","amount":1950,"calcType":"percentage","capAmount":null,"percentage":13,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[{"label":"Basic","operator":"+"},{"label":"DA","operator":"+"}],"formulaVersion":1,"costComponentId":"cc161170-0001-4001-8001-000000000001","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"min(basic + da, 15000) * 0.13","fixedDutyComponents":[]},
    {"name":"ER ESI 3.25% (Gross)","state":"N/A","amount":655,"calcType":"percentage","capAmount":null,"percentage":0,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc152370-0001-4001-8001-000000000004","fixedCalcMethod":"flat","fixedDutyDivisor":"base_days","deductionCalcType":"earned_salary","formulaExpression":"gross * 0.0325","fixedDutyComponents":[]},
    {"name":"Uniform Allowance (Fixed) Employer Cost","state":"N/A","amount":300,"calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":"cc900000-0001-4001-8001-000000000004","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":null,"fixedDutyComponents":[]},
    {"name":"ER LWF - MH","state":"Maharashtra","amount":12.5,"calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":"preset","capFlatAmount":null,"baseComponents":[],"formulaVersion":3,"costComponentId":"70421294-a437-4e27-a0bd-5585513b8039","fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":null,"fixedDutyComponents":[]},
    {"name":"Custom Management Fee","state":"Custom fixed amount","amount":1729,"calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":null,"capFlatAmount":null,"baseComponents":[],"formulaVersion":null,"costComponentId":"__custom_management_fee__","formulaExpression":null}
  ]'::jsonb,
  NULL,
  8,
  'c82178db-3864-471f-b078-1510ea49a2f9'
FROM client_contracts cc
WHERE cc.contract_code = 'CON14141';

COMMIT;
