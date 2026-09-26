-- CLI2800 Banswada (Telangana) -> Zone II flat BFL rate (21,974.62), copied from CLI4273
create table if not exists public._bkp_cli2800_rate as select * from public.contract_resources where id='385d3683-defc-405a-84b3-08b6fc196d0d';
update public.units set zone='Zone II', updated_at=now() where code='CLI2800';
update public.contract_resources t set components=s.components, gross=s.gross, benefits=s.benefits, deductions=s.deductions,
  employer_contributions=s.employer_contributions, shift_hours=s.shift_hours, payroll_day_base_id=s.payroll_day_base_id,
  billing_day_base_id=s.billing_day_base_id, updated_at=now()
from public.contract_resources s where s.id='e351a4d8-1989-4167-a66c-fb0c64dac687' and t.id='385d3683-defc-405a-84b3-08b6fc196d0d';
