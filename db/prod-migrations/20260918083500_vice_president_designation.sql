-- Col. Umed Singh (employee code 31993) is the Vice President in charge of Operations.
-- His record carried "Asst. Vice President" (AVP), which is also used by another officer,
-- so a distinct "Vice President" (VP) designation is created and pointed at him.
-- Nothing else is relabelled: the other AVP and the Senior Vice President are untouched.

begin;

-- 1. Add the designation to the master list (idempotent).
insert into public.designations (name, code, enabled, billable)
select 'Vice President', 'VP', true, false
where not exists (
  select 1 from public.designations where lower(btrim(name)) = 'vice president'
);

-- 2. Point the employee at it.
update public.candidates
set designation_id = (
  select id from public.designations
  where lower(btrim(name)) = 'vice president'
  order by created_at
  limit 1
)
where employee_code = '31993';

-- 3. Keep the site-level designation record in step with the employee record.
update public.candidate_units cu
set designation_id = d.id,
    designation_assigned_at = now()
from public.candidates c
cross join lateral (
  select id from public.designations
  where lower(btrim(name)) = 'vice president'
  order by created_at
  limit 1
) d
where cu.candidate_id = c.id
  and c.employee_code = '31993'
  and cu.designation_id is distinct from d.id;

commit;
