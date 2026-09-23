-- L&T sites now bill/pay on "Days Minus Four" (31-day window => 27 days).
-- Attendance was captured under the old 26-day cap, so anyone sitting at
-- exactly 26 present days with extra duty must absorb ONE extra-duty day back
-- into attendance (26 present + 5 ED => 27 present + 4 ED).
-- Period: 21 Aug 2026 - 20 Sep 2026 (21-to-20 payroll window).
-- Relievers are skipped: they may not carry present codes at a unit.

with lt_units as (
  select distinct cc.unit_id
  from client_contracts cc
  join units u on u.id = cc.unit_id
  join customers cu on cu.id = u.customer_id
  join payroll_windows pw on pw.id = cc.payroll_window_id
  join contract_resources cr on cr.contract_id = cc.id
  join payroll_day_bases pdb on pdb.id = cr.payroll_day_base_id
  where (cu.name ilike '%L&T%' or cu.name ilike '%larsen%')
    and cc.status = 'active'
    and cc.record_type = 'client'
    and pdb.method = 'actual_minus_days'
    and pw.window_start_day = 21
),
agg as (
  select ae.unit_id, ae.candidate_id, ae.designation_id
  from attendance_entries ae
  join lt_units l on l.unit_id = ae.unit_id
  left join attendance_codes ac on ac.code = ae.code
  where ae.entry_date between date '2026-08-21' and date '2026-09-20'
  group by 1, 2, 3
  having sum(case when ac.counts_as_present then coalesce(ac.day_value, 1) else 0 end) = 26
     and sum(coalesce(ae.ot_hours, 0)) > 0
),
eligible as (
  select a.*
  from agg a
  where not exists (
    select 1 from candidate_units cu
    where cu.unit_id = a.unit_id
      and cu.candidate_id = a.candidate_id
      and coalesce(cu.is_reliever, false) = true
  )
),
picked as (
  select distinct on (e.unit_id, e.candidate_id, e.designation_id) ae.id, ae.ot_hours
  from eligible e
  join attendance_entries ae
    on ae.unit_id = e.unit_id
   and ae.candidate_id = e.candidate_id
   and ae.designation_id is not distinct from e.designation_id
   and ae.entry_date between date '2026-08-21' and date '2026-09-20'
   and coalesce(ae.ot_hours, 0) >= 1
   and coalesce(ae.code, '') = ''
  order by e.unit_id, e.candidate_id, e.designation_id, ae.entry_date
)
update attendance_entries ae
set code = 'P',
    ot_hours = greatest(coalesce(ae.ot_hours, 0) - 1, 0),
    updated_at = now()
from picked p
where ae.id = p.id;
