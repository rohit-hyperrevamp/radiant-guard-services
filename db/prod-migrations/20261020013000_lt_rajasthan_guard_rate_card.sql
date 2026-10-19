-- L&T Finance Rajasthan (zone North) Un-armed Security Guard 12h rate card, per signed sheet:
-- Salary: Basic 7410, HRA 741, Skill 5400, NH 94.85, Additional 4h 3705 = 17350.85; EE PF 1800, ESI 55.58, PT 200 -> net 15295.27
-- Billing: + Uniform 300, Washing 100 (billing only), ER PF 1950, ESI 240.83, PD 830.66, Gratuity 356.42, Bonus 617.25, Admin 1200, Service 600 = 23546.01

-- 1) CLI4362 Sujangarh paid Uniform/Washing to the guard, had no NH and no EE PF: copy the standard line from CLI4337.
update public.contract_resources t set
  components = s.components, deductions = s.deductions,
  employer_contributions = s.employer_contributions, benefits = s.benefits,
  payroll_day_base_id = s.payroll_day_base_id, billing_day_base_id = s.billing_day_base_id,
  updated_at = now()
from public.contract_resources s
where s.id = '2cee59f7-5051-4f6c-b306-071a3e79e053'
  and t.id = 'bec0c337-04b2-4ecb-b7d7-a7a10a3a2d9b';

-- 2) Saved EE PF / ESI amounts shown as 0 on Rajasthan Security Guard lines: store the evaluated sheet values.
update public.contract_resources r set deductions = (
  select jsonb_agg(case
    when x->>'name' like 'EE EPF%' then jsonb_set(x,'{amount}','1800'::jsonb)
    when x->>'name' like 'EE ESI%' then jsonb_set(x,'{amount}','55.58'::jsonb)
    else x end order by o)
  from jsonb_array_elements(r.deductions) with ordinality e(x,o)), updated_at = now()
from public.client_contracts c, public.units u, public.designations d
where c.id = r.contract_id and c.status = 'active' and u.id = c.unit_id and d.id = r.designation_id
  and d.name = 'Security Guard' and r.shift_hours = 12
  and u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353' and u.zone = 'North'
  and u.code <> 'CLI4347';
