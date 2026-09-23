-- Reconcile L&T Finance Maharashtra 12-hour Security Guard resources to the
-- district Guard Board columns in the supplied 12 HRS Maharashtra rate sheet.
begin;

-- Reuse already-reconciled district templates where the production contract
-- contains the exact sheet structure and amounts.
with rate_map(target_code, source_code) as (
  values
    ('CLI4208', 'CLI4276'), ('CLI4221', 'CLI4276'), ('CLI4277', 'CLI4276'),
    ('CLI4278', 'CLI4276'), ('CLI4279', 'CLI4276'), ('CLI4280', 'CLI4276'),
    ('CLI4281', 'CLI4276'), ('CLI4299', 'CLI4276'), ('CLI4408', 'CLI4276'),
    ('CLI4290', 'CLI4305'),
    ('CLI4437', 'CLI4435'),
    ('CLI4348', 'CLI4373'),
    ('CLI4433', 'CLI4436'), ('CLI4438', 'CLI4436'),
    ('CLI4313', 'CLI4289'),
    ('CLI4320', 'CLI4432'), ('CLI4328', 'CLI4432'), ('CLI4345', 'CLI4432'),
    ('CLI4287', 'CLI4222')
), source_rates as (
  select rm.target_code, src.components, src.gross, src.employer_contributions,
         src.billing_day_base_id
    from rate_map rm
    join units su on su.code = rm.source_code
    join client_contracts sc on sc.unit_id = su.id
    join contract_resources src on src.contract_id = sc.id and src.shift_hours = 12
    join designations sd on sd.id = src.designation_id and sd.name = 'Security Guard'
)
update contract_resources target
   set components = sr.components,
       gross = sr.gross,
       employer_contributions = sr.employer_contributions,
       billing_day_base_id = sr.billing_day_base_id,
       updated_at = now()
  from client_contracts tc
  join units tu on tu.id = tc.unit_id
  join source_rates sr on sr.target_code = tu.code
  join designations td on td.name = 'Security Guard'
 where target.contract_id = tc.id
   and target.designation_id = td.id
   and target.shift_hours = 12
   and tu.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353'
   and lower(coalesce(tu.billing_state, '')) = 'maharashtra';

-- Latur / Osmanabad / Beed column: Beed uses the Latur district rate.
update contract_resources r
   set components = '[{"name":"Basic","amount":10521,"allowanceId":"44e4177f-b612-44ac-9b4b-227da493a4c9","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},{"name":"DA","amount":3900,"allowanceId":"4ac31d78-dafd-44d2-9123-2168ce28917a","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},{"name":"HRA","amount":721,"calcType":"fixed","allowanceId":"aa113290-0001-4001-8001-000000000001","formulaMode":null,"includeInOt":false,"formulaVersion":1,"formulaExpression":""},{"name":"Conveyance Allowance","amount":400,"allowanceId":"ddd82b23-d385-4f0a-99bb-4cd64ec2f973","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},{"name":"Washing Allowance","amount":700,"allowanceId":"9a96de53-a582-4f5a-a8de-bb349335cb47","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},{"name":"Education Allowance","amount":400,"allowanceId":"aa113290-0001-4001-8001-000000000002","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},{"name":"Additional 4 Hours Allowance 50% (Basic+DA)","amount":7210.5,"allowanceId":"aa121500-0001-4001-8001-000000000001","formulaMode":"advanced","includeInOt":false,"formulaVersion":1,"formulaExpression":"(basic + da) * 0.50"}]'::jsonb,
       gross = 23852.5,
       employer_contributions = '[{"name":"ER EPF 12% (Basic+DA, cap 15000)","state":"N/A","amount":1800,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc120000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"EPF Admin 1% (Basic+DA, cap 15000)","state":"N/A","amount":150,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc010000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"ER LWF - MH","state":"Maharashtra","amount":12.5,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"70421294-a437-4e27-a0bd-5585513b8039","deductionCalcType":"fixed_amount"},{"name":"ER ESI 3.25% (Basic+DA)","state":"N/A","amount":469,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc161330-0001-4001-8001-000000000002","deductionCalcType":"earned_salary"},{"name":"Leave with Wages 6% (Basic+DA) Employer Cost","state":"N/A","amount":865,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc101120-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Paid Holiday 1% (Basic+DA) Employer Cost","state":"N/A","amount":144,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc161320-0001-4001-8001-000000000002","deductionCalcType":"earned_salary"},{"name":"Bonus / Exgratia 10% (Basic+DA) Employer Cost","state":"N/A","amount":1442,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc100000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Uniform 4% (Basic+DA) Employer Cost","state":"N/A","amount":577,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc040000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Gratuity 4% (Basic+DA)","state":"N/A","amount":577,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc143130-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Guard Board Levy 3% (Basic+DA)","state":"Maharashtra","amount":433,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc152250-0001-4001-8001-000000000005","deductionCalcType":"earned_salary"},{"name":"Service Charge (Fixed)","state":"N/A","amount":600,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc900000-0001-4001-8001-000000000002","deductionCalcType":"fixed_amount"}]'::jsonb,
       updated_at = now()
  from client_contracts c
  join units u on u.id = c.unit_id
  join designations d on d.name = 'Security Guard'
 where r.contract_id = c.id and r.designation_id = d.id and r.shift_hours = 12
   and u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353'
   and u.code = 'CLI4286';

-- Aurangabad column: Nanded and nearby Parbhani follow the supplied mapping.
update contract_resources r
   set components = '[{"name":"Basic","amount":13274,"allowanceId":"44e4177f-b612-44ac-9b4b-227da493a4c9","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},{"name":"DA","amount":3900,"allowanceId":"4ac31d78-dafd-44d2-9123-2168ce28917a","formulaMode":"preset","includeInOt":true,"formulaVersion":1,"formulaExpression":null},{"name":"HRA","amount":859,"calcType":"fixed","allowanceId":"aa113290-0001-4001-8001-000000000001","formulaMode":null,"includeInOt":false,"formulaVersion":1,"formulaExpression":""},{"name":"Conveyance Allowance","amount":660,"allowanceId":"ddd82b23-d385-4f0a-99bb-4cd64ec2f973","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},{"name":"Washing Allowance","amount":660,"allowanceId":"9a96de53-a582-4f5a-a8de-bb349335cb47","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},{"name":"Education Allowance","amount":550,"allowanceId":"aa113290-0001-4001-8001-000000000002","formulaMode":"preset","includeInOt":false,"formulaVersion":1,"formulaExpression":null},{"name":"Additional 4 Hours Allowance 50% (Basic+DA)","amount":8587,"allowanceId":"aa121500-0001-4001-8001-000000000001","formulaMode":"advanced","includeInOt":false,"formulaVersion":1,"formulaExpression":"(basic + da) * 0.50"}]'::jsonb,
       gross = 28490,
       employer_contributions = '[{"name":"ER EPF 12% (Basic+DA, cap 15000)","state":"N/A","amount":1800,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc120000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"EPF Admin 1% (Basic+DA, cap 15000)","state":"N/A","amount":150,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc010000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"ER LWF - MH","state":"Maharashtra","amount":12.5,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"70421294-a437-4e27-a0bd-5585513b8039","deductionCalcType":"fixed_amount"},{"name":"ER ESI 3.25% (Basic+DA)","state":"N/A","amount":558,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc161330-0001-4001-8001-000000000002","deductionCalcType":"earned_salary"},{"name":"Leave with Wages 6% (Basic+DA) Employer Cost","state":"N/A","amount":930,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc101120-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Paid Holiday 1% (Basic+DA) Employer Cost","state":"N/A","amount":172,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc161320-0001-4001-8001-000000000002","deductionCalcType":"earned_salary"},{"name":"Bonus / Exgratia 10% (Basic+DA) Employer Cost","state":"N/A","amount":1717,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc100000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Uniform 4% (Basic+DA) Employer Cost","state":"N/A","amount":687,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc040000-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Gratuity 4% (Basic+DA)","state":"N/A","amount":687,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc143130-0001-4001-8001-000000000001","deductionCalcType":"earned_salary"},{"name":"Guard Board Levy 3% (Basic+DA)","state":"Maharashtra","amount":515,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc152250-0001-4001-8001-000000000005","deductionCalcType":"earned_salary"},{"name":"Service Charge (Fixed)","state":"N/A","amount":600,"calcType":"fixed","formulaMode":"preset","formulaVersion":1,"costComponentId":"cc900000-0001-4001-8001-000000000002","deductionCalcType":"fixed_amount"}]'::jsonb,
       updated_at = now()
  from client_contracts c
  join units u on u.id = c.unit_id
  join designations d on d.name = 'Security Guard'
 where r.contract_id = c.id and r.designation_id = d.id and r.shift_hours = 12
   and u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353'
   and u.code in ('CLI4288', 'CLI4336');

commit;