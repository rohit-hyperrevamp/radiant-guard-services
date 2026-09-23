-- L&T Finance: Satana (CLI4347 / CON15972) is in Nashik district.
-- It was wrongly on the Rajasthan rate column. Copy the reconciled Nashik
-- template (CLI4289 / CON15936) and correct the unit's billing state.

update public.units u
set billing_state = 'Maharashtra'
where u.code = 'CLI4347' and u.billing_state <> 'Maharashtra';

with src as (
  select cr.components, cr.benefits, cr.deductions, cr.employer_contributions,
         cr.gross, cr.payroll_day_base_id, cr.billing_day_base_id, cr.shift_hours
  from public.contract_resources cr
  join public.client_contracts cc on cc.id = cr.contract_id
  join public.units u on u.id = cc.unit_id
  where u.code = 'CLI4289'
  limit 1
)
update public.contract_resources tgt
set components = src.components,
    benefits = src.benefits,
    deductions = src.deductions,
    employer_contributions = src.employer_contributions,
    gross = src.gross,
    payroll_day_base_id = src.payroll_day_base_id,
    billing_day_base_id = src.billing_day_base_id,
    updated_at = now()
from src, public.client_contracts cc, public.units u
where tgt.contract_id = cc.id
  and cc.id = tgt.contract_id
  and u.id = cc.unit_id
  and u.code = 'CLI4347'
  and tgt.shift_hours = 12;
