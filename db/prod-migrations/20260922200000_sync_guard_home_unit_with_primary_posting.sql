-- Guards' home unit (candidates.unit_id) must always follow their primary posting
-- in candidate_units. Attendance uploads made a unit primary without syncing the
-- home unit, so guards kept showing an older client site.

-- 1. One-off data fix for every guard whose home unit disagrees with the primary posting.
update public.candidates c
set unit_id = cu.unit_id
from public.candidate_units cu
where cu.candidate_id = c.id
  and cu.is_primary is true
  and c.role_key = 'guard'
  and (c.unit_id is null or c.unit_id <> cu.unit_id);

-- 2. Drop stale reliever links that carry no attendance at that unit.
delete from public.candidate_units cu
using public.candidates c
where cu.candidate_id = c.id
  and c.role_key = 'guard'
  and cu.is_reliever is true
  and cu.is_primary is not true
  and not exists (
    select 1 from public.attendance_entries ae
    where ae.candidate_id = cu.candidate_id
      and ae.unit_id = cu.unit_id
  );

-- 3. Keep them in sync from now on: whenever a posting becomes primary, the guard's
--    home unit moves with it.
create or replace function public.sync_guard_home_unit_from_primary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_primary is true then
    update public.candidates
    set unit_id = new.unit_id
    where id = new.candidate_id
      and role_key = 'guard'
      and (unit_id is null or unit_id <> new.unit_id);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_guard_home_unit_from_primary() from public;

drop trigger if exists candidate_units_sync_guard_home_unit on public.candidate_units;
create trigger candidate_units_sync_guard_home_unit
after insert or update of is_primary, unit_id on public.candidate_units
for each row execute function public.sync_guard_home_unit_from_primary();
