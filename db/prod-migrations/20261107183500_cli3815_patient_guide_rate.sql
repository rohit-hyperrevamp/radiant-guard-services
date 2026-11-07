-- CLI3815 (CON13042) Patient Guide only, per supplied image-126 rate sheet.
-- Removes duplicate Uniform/LWF employer lines, sets fee to 7.5% of Total CTC,
-- stores ESI rounded up (629 / 146) and adds employee LWF 4.17. Other roles untouched.
CREATE TABLE IF NOT EXISTS public.backup_cli3815_res_20261107 AS
  SELECT * FROM contract_resources WHERE id = '47020118-b1ef-416c-9141-a0e1972e22ce';

INSERT INTO cost_components (id, code, name, description, party, state, calc_type, percentage,
  formula_mode, formula_expression, formula_version, fixed_calc_method, deduction_calc_type, enabled)
SELECT 'cc381500-0001-4001-8001-000000000075', 'MGMT_CTC_7_5', 'Management Fee 7.5% (Total CTC)',
  '7.5% of Total CTC, excluding reliever charges and management fee.', 'employer', 'N/A', 'percentage', 7.5,
  'advanced', 'total_ctc * 0.075', 1, 'flat', 'earned_salary', true
WHERE NOT EXISTS (SELECT 1 FROM cost_components WHERE id = 'cc381500-0001-4001-8001-000000000075');

UPDATE contract_resources r SET
  employer_contributions = (
    SELECT jsonb_agg(
      CASE
        WHEN e->>'name' LIKE 'ER ESI%' THEN jsonb_set(e, '{amount}', '629'::jsonb)
        ELSE e END ORDER BY ord)
    FROM jsonb_array_elements(r.employer_contributions) WITH ORDINALITY t(e, ord)
    WHERE e->>'name' NOT IN ('Uniform Charges', 'LWF Employer Contribution', 'Custom Management Fee')
  ) || jsonb_build_array(jsonb_build_object(
    'name', 'Management Fee 7.5% (Total CTC)', 'state', 'N/A', 'amount', 1667.29,
    'calcType', 'percentage', 'capAmount', null, 'percentage', 7.5, 'formulaMode', 'advanced',
    'capFlatAmount', null, 'baseComponents', '[]'::jsonb, 'formulaVersion', 1,
    'costComponentId', 'cc381500-0001-4001-8001-000000000075', 'fixedCalcMethod', 'flat',
    'fixedDutyDivisor', null, 'deductionCalcType', 'earned_salary',
    'formulaExpression', 'total_ctc * 0.075', 'fixedDutyComponents', '[]'::jsonb)),
  deductions = (
    SELECT jsonb_agg(
      CASE WHEN e->>'name' LIKE 'EE ESI%' THEN jsonb_set(e, '{amount}', '146'::jsonb) ELSE e END ORDER BY ord)
    FROM jsonb_array_elements(r.deductions) WITH ORDINALITY t(e, ord)
    WHERE e->>'name' <> 'EE LWF - MH'
  ) || jsonb_build_array(jsonb_build_object(
    'name', 'EE LWF - MH', 'state', 'Maharashtra', 'amount', 4.17, 'calcType', 'fixed',
    'capAmount', null, 'percentage', 0, 'formulaMode', 'preset', 'capFlatAmount', null,
    'baseComponents', '[]'::jsonb, 'formulaVersion', 1,
    'costComponentId', 'c1e5b0a4-1111-4b7a-9f21-0a1b2c3d4e5f', 'contractOverride', true,
    'fixedCalcMethod', 'flat', 'fixedDutyDivisor', null, 'deductionCalcType', 'earned_salary',
    'formulaExpression', null, 'fixedDutyComponents', '[]'::jsonb)),
  updated_at = now()
WHERE r.id = '47020118-b1ef-416c-9141-a0e1972e22ce';
