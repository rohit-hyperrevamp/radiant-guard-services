-- Relievers are Extra-Duty-only. Legacy reliever rows carried day codes (P/A/WO...)
-- which were counted in totals but invisible/uneditable in the ED row.
-- Move present day value into ot_hours (ED days) and blank every reliever code.
update attendance_entries ae
set ot_hours = coalesce(ae.ot_hours,0)
      + case when coalesce(ac.counts_as_present,false) then coalesce(ac.day_value,1) else 0 end,
    code = '',
    updated_at = now()
from candidate_units cu, attendance_entries x
left join attendance_codes ac on ac.code = x.code
where x.id = ae.id
  and cu.candidate_id = ae.candidate_id and cu.unit_id = ae.unit_id
  and cu.is_reliever = true
  and coalesce(ae.code,'') <> '';
