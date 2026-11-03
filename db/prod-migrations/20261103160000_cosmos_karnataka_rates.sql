-- Cosmos Bank Karnataka (CLI920, CLI921): supplied 12-hour Security Guard sheet, total ₹17,690.25
CREATE TABLE IF NOT EXISTS backup_contract_resources_cosmos_ka_20261103 AS
SELECT r.* FROM contract_resources r JOIN client_contracts c ON c.id=r.contract_id JOIN units u ON u.id=c.unit_id
WHERE u.code IN ('CLI920','CLI921') AND c.status='active';

UPDATE contract_resources r SET
  shift_hours = 12,
  round_off_final = false,
  gross = 14160.42,
  components = '[
   {"name":"Basic","amount":11795.68,"calcType":"fixed","allowanceId":null,"formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
   {"name":"Washing Allowance","amount":100.0,"calcType":"fixed","allowanceId":null,"formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
   {"name":"Paid Holiday","amount":117.96,"calcType":"fixed","allowanceId":null,"formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
   {"name":"Leave Pay","amount":471.83,"calcType":"fixed","allowanceId":null,"formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},
   {"name":"Bonus","amount":982.58,"calcType":"fixed","allowanceId":null,"formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
   {"name":"uniform allowance","amount":125.0,"calcType":"fixed","allowanceId":null,"formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},
   {"name":"Gratuity Amount","amount":567.37,"calcType":"fixed","allowanceId":"6edb0208-8177-430d-896c-3e1dabb40a19","includeInOt":true}
  ]'::jsonb,
  employer_contributions = '[
   {"name":"ER EPF 13% (Basic, cap 24000)","state":"N/A","amount":1533.44,"calcType":"percentage","capAmount":24000,"roundMode":null,"percentage":13,"formulaMode":"advanced","capFlatAmount":null,"baseComponents":[],"formulaVersion":1,"costComponentId":null,"fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":"min(basic, 24000) * 0.13","fixedDutyComponents":[]},
   {"name":"ER ESI 3.25% (Basic + Paid Holiday)","state":"N/A","amount":387.19,"calcType":"percentage","capAmount":21000,"roundMode":null,"esiLimitOn":["basic","washing_allowance","uniform_allowance"],"percentage":3.25,"formulaMode":"advanced","capFlatAmount":null,"esiLimitBasis":"payrate","baseComponents":[],"formulaVersion":1,"costComponentId":null,"fixedCalcMethod":"flat","fixedDutyDivisor":null,"deductionCalcType":"earned_salary","formulaExpression":"(basic + paid_holiday) * 0.0325","fixedDutyComponents":[]},
   {"name":"Labour Welfare Fund","state":"Custom fixed amount","amount":1.0,"calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":null,"capFlatAmount":null,"baseComponents":[],"formulaVersion":null,"costComponentId":null,"formulaExpression":null},
   {"name":"Custom Management Fee","state":"Custom fixed amount","amount":1608.20,"calcType":"fixed","capAmount":null,"percentage":0,"formulaMode":null,"capFlatAmount":null,"baseComponents":[],"formulaVersion":null,"costComponentId":"__custom_management_fee__","formulaExpression":null}
  ]'::jsonb
FROM client_contracts c JOIN units u ON u.id=c.unit_id
WHERE c.id=r.contract_id AND u.code IN ('CLI920','CLI921') AND c.status='active' AND r.gross=14161.00;
