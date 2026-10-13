-- Extra Duty multiplier per contract role (Pages "Basic+DA 2X" style OT).
-- ED per duty = (selected ED-base components / payroll days) x ot_multiplier.
alter table public.contract_resources add column if not exists ot_multiplier numeric not null default 1;
alter table public.contract_resources drop constraint if exists contract_resources_ot_multiplier_chk;
alter table public.contract_resources add constraint contract_resources_ot_multiplier_chk check (ot_multiplier > 0 and ot_multiplier <= 5);
