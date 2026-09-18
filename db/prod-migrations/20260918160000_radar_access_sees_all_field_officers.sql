-- Anyone with Radar (field_sense) view access can see every field officer's
-- location data: live punches, visits and track points.

create or replace function public.current_user_can_view_radar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin_user()
    or public.current_user_has_permission('field_sense', null, 'view')
    or public.current_user_has_permission('field_sense', 'dashboard', 'view'),
    false
  );
$$;

grant execute on function public.current_user_can_view_radar() to authenticated, service_role;

create or replace function public.current_user_can_view_self_attendance(
  _candidate_id uuid,
  _unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _candidate_id = (select public.current_user_candidate_id())
    or (select public.current_user_can_view_radar())
    or (select public.current_user_role_key()) = any (array[
      'hr','leadership','admin','super_admin','branch_manager',
      'operations','operations_manager','vp_operations'
    ])
    or exists (
      select 1 from public.candidate_reporting_managers crm
      where crm.candidate_id = _candidate_id
        and crm.manager_candidate_id = (select public.current_user_candidate_id())
    )
    or (
      _unit_id is not null
      and _unit_id = any ((select public.current_user_unit_ids()))
    )
    or _candidate_id in (select public.current_user_assigned_guard_ids());
$$;

grant execute on function public.current_user_can_view_self_attendance(uuid, uuid) to authenticated, service_role;

-- field_visits
drop policy if exists "Admins read all visits" on public.field_visits;
create policy "Radar readers read all visits"
on public.field_visits
for select
to authenticated
using (
  (select public.current_user_can_view_radar())
  or public.is_admin_user()
  or (select public.current_user_role_key()) = any (array['hr','leadership'])
);

drop policy if exists "Admins update all visits" on public.field_visits;
create policy "Radar managers update all visits"
on public.field_visits
for update
to authenticated
using (
  public.is_admin_user()
  or (select public.current_user_role_key()) = any (array['hr','leadership','operations_manager','vp_operations'])
);

-- field_track_points
drop policy if exists "Admins read all tracks" on public.field_track_points;
create policy "Radar readers read all tracks"
on public.field_track_points
for select
to authenticated
using (
  (select public.current_user_can_view_radar())
  or public.is_admin_user()
  or (select public.current_user_role_key()) = any (array['hr','leadership'])
);

-- field_visit_requests: radar readers can see all requests
drop policy if exists "fvr radar read all" on public.field_visit_requests;
create policy "fvr radar read all"
on public.field_visit_requests
for select
to authenticated
using ((select public.current_user_can_view_radar()));
