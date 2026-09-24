-- Koramangala CON15944: 12h guard = Rathi structure (1435.52/day); add 8h guard (27825.19/26 = 1070.20/day).
update contract_resources k set components=r.components, employer_contributions=r.employer_contributions, updated_at=now()
from contract_resources r where r.id='ad853fdd-0393-4a24-9ed1-a471851c0731' and k.id='5e1fb464-99f5-43d9-bd77-07cf0de85664';

insert into contract_resources (contract_id, designation_id, service_type_id, quantity, components, gross, sort_order,
  payroll_day_base_id, benefits, deductions, employer_contributions, role_key, shift_hours, billing_day_base_id)
select contract_id, designation_id, service_type_id, 1,
  jsonb_build_array(components->0, components->1, components->2, components->3),
  19396.66, coalesce(sort_order,0)+1, payroll_day_base_id, benefits, deductions, employer_contributions, role_key, 8, billing_day_base_id
from contract_resources k where k.id='5e1fb464-99f5-43d9-bd77-07cf0de85664'
  and not exists (select 1 from contract_resources x where x.contract_id=k.contract_id and x.designation_id=k.designation_id and x.shift_hours=8);

-- Per-day rates on the rate sheets are monthly / 26: bill these three contracts on Fixed 26 Days.
update contract_resources set billing_day_base_id='abea52aa-6151-4d0a-9209-f102d3ecf226', updated_at=now()
where contract_id in (select id from client_contracts where contract_code in ('CON15944','CON16019','CON15975'));
