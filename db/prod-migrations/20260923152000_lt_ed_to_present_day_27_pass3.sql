-- Pass 3 of the L&T 26 -> 27 present-day correction.
-- Remaining cases carry their extra duty on days that already hold a code
-- (double shift on a present day) and have no unpaid day left. For those, one
-- paid weekly off (WO) becomes Present and one extra-duty day is dropped.
-- Period: 21 Aug 2026 - 20 Sep 2026.

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
  select a.* from agg a
  where not exists (
    select 1 from candidate_units cu
    where cu.unit_id = a.unit_id and cu.candidate_id = a.candidate_id
      and coalesce(cu.is_reliever, false) = true
  )
),
-- the extra-duty day to give up
ed_pick as (
  select distinct on (e.unit_id, e.candidate_id, e.designation_id)
         e.unit_id, e.candidate_id, e.designation_id, ae.id as ed_id
  from eligible e
  join attendance_entries ae
    on ae.unit_id = e.unit_id and ae.candidate_id = e.candidate_id
   and ae.designation_id is not distinct from e.designation_id
   and ae.entry_date between date '2026-08-21' and date '2026-09-20'
   and coalesce(ae.ot_hours, 0) >= 1
  order by e.unit_id, e.candidate_id, e.designation_id, ae.ot_hours desc, ae.entry_date
),
-- the day that becomes the 27th present day
day_pick as (
  select distinct on (e.unit_id, e.candidate_id, e.designation_id)
         e.unit_id, e.candidate_id, e.designation_id, ae.id as day_id
  from eligible e
  join attendance_entries ae
    on ae.unit_id = e.unit_id and ae.candidate_id = e.candidate_id
   and ae.designation_id is not distinct from e.designation_id
   and ae.entry_date between date '2026-08-21' and date '2026-09-20'
  left join attendance_codes ac on ac.code = ae.code
  where ae.code = 'WO'
    and coalesce(ae.ot_hours, 0) = 0
    and ae.id not in (select ed_id from ed_pick)
  order by e.unit_id, e.candidate_id, e.designation_id,
           ae.entry_date
),
pairs as (
  select d.day_id, p.ed_id
  from day_pick d join ed_pick p
    on p.unit_id = d.unit_id and p.candidate_id = d.candidate_id
   and p.designation_id is not distinct from d.designation_id
),
drop_ed as (
  update attendance_entries ae
  set ot_hours = greatest(coalesce(ae.ot_hours, 0) - 1, 0), updated_at = now()
  where ae.id in (select ed_id from pairs)
  returning ae.id
)
update attendance_entries ae
set code = 'P', updated_at = now()
where ae.id in (select day_id from pairs)
  and (select count(*) from drop_ed) >= 0;
