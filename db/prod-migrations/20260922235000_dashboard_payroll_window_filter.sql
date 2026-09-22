-- Filter leadership dashboard lifecycle totals by the selected contract payroll window.
drop function if exists public.dashboard_lifecycle_counts(integer, integer);

create or replace function public.dashboard_lifecycle_counts(
  p_year integer,
  p_month integer,
  p_window_start integer,
  p_window_end integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _role text := public.current_user_role_key();
  _cand uuid := public.current_user_candidate_id();
  _fo boolean := coalesce(_role, '') = 'field_officer';
  _result jsonb;
begin
  with nb as (
    select unnest(array[
      'field_officer','branch_manager','hr','leadership','transport','inventory',
      'admin','super_admin','user','accounts','operations','operations_manager',
      'area_manager','regional_manager'
    ]) as k
  ),
  cand as (
    select c.id, c.unit_id
    from public.candidates c
    where c.is_enabled
      and c.status = 'active'
      and coalesce(c.non_billable, false) = false
      and lower(coalesce(c.role_key, '')) not in (select k from nb)
  ),
  active_contracts as (
    select distinct on (cc.unit_id)
      cc.unit_id,
      coalesce(pw.window_start_day, 1) as window_start_day,
      coalesce(pw.window_end_day, 31) as window_end_day
    from public.client_contracts cc
    left join public.payroll_windows pw on pw.id = cc.payroll_window_id
    where cc.status = 'active' and cc.unit_id is not null
    order by cc.unit_id, cc.start_date desc nulls last, cc.created_at desc
  ),
  links as (
    select cu.unit_id from public.candidate_units cu join cand c on c.id = cu.candidate_id
    union
    select c.unit_id from cand c where c.unit_id is not null
    union
    select u.id
    from public.employee_scope_assignments a
    join cand c on c.id = a.candidate_id
    join public.units u on (
      (a.scope_type = 'unit' and u.id::text = a.scope_id)
      or (a.scope_type = 'branch' and u.branch_id::text = a.scope_id)
      or (a.scope_type = 'customer' and u.customer_id::text = a.scope_id)
      or (a.scope_type = 'state' and u.billing_state = a.scope_id)
    )
  ),
  fo_units as (
    select unit_id from public.field_officer_scope where candidate_id = _cand
  ),
  charter_units as (
    select unit_id from active_contracts
    union
    select unit_id from links where unit_id is not null
  ),
  scoped_units as (
    select cu.unit_id, ac.window_start_day, ac.window_end_day
    from charter_units cu
    left join active_contracts ac on ac.unit_id = cu.unit_id
    where ((not _fo) or cu.unit_id in (select unit_id from fo_units))
      and (
        p_window_start is null
        or (ac.window_start_day = p_window_start and ac.window_end_day = p_window_end)
      )
  ),
  periods as (
    select
      su.unit_id,
      case
        when su.window_start_day <= 1 or su.window_end_day <= 0 or su.window_end_day >= su.window_start_day
        then make_date(p_year, p_month, 1)
        else make_date(
          extract(year from (make_date(p_year, p_month, 1) - interval '1 month'))::integer,
          extract(month from (make_date(p_year, p_month, 1) - interval '1 month'))::integer,
          least(su.window_start_day, extract(day from (date_trunc('month', make_date(p_year, p_month, 1)) - interval '1 day'))::integer)
        )
      end as period_start,
      case
        when su.window_start_day <= 1 or su.window_end_day <= 0 or su.window_end_day >= su.window_start_day
        then (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
        else make_date(
          p_year,
          p_month,
          least(su.window_end_day, extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::integer)
        )
      end as period_end
    from scoped_units su
  ),
  lifecycle as (
    select
      p.unit_id,
      coalesce(a.status, 'none') as attendance_status,
      coalesce(r.payroll_status, 'open') as payroll_status,
      coalesce(r.invoice_status, 'open') as invoice_status
    from periods p
    left join public.attendance_sheets a
      on a.unit_id = p.unit_id and a.period_start = p.period_start and a.period_end = p.period_end
    left join public.payroll_runs r
      on r.unit_id = p.unit_id and r.period_start = p.period_start and r.period_end = p.period_end
  )
  select jsonb_build_object(
    'total', count(*),
    'attendance', jsonb_build_object(
      'approved', count(*) filter (where attendance_status = 'approved'),
      'submitted', count(*) filter (where attendance_status = 'submitted'),
      'rejected', count(*) filter (where attendance_status = 'rejected'),
      'open', count(*) filter (where attendance_status not in ('approved', 'submitted', 'rejected'))
    ),
    'payroll', jsonb_build_object(
      'processed', count(*) filter (where payroll_status = 'processed'),
      'ready', count(*) filter (where payroll_status <> 'processed' and attendance_status = 'approved'),
      'open', count(*) filter (where payroll_status <> 'processed' and attendance_status <> 'approved')
    ),
    'invoice', jsonb_build_object(
      'processed', count(*) filter (where invoice_status = 'processed'),
      'ready', count(*) filter (where invoice_status <> 'processed' and attendance_status = 'approved'),
      'open', count(*) filter (where invoice_status <> 'processed' and attendance_status <> 'approved')
    )
  ) into _result
  from lifecycle;

  return coalesce(_result, '{"total":0,"attendance":{"approved":0,"submitted":0,"rejected":0,"open":0},"payroll":{"processed":0,"ready":0,"open":0},"invoice":{"processed":0,"ready":0,"open":0}}'::jsonb);
end;
$$;

revoke all on function public.dashboard_lifecycle_counts(integer, integer, integer, integer) from public;
grant execute on function public.dashboard_lifecycle_counts(integer, integer, integer, integer) to authenticated;
grant execute on function public.dashboard_lifecycle_counts(integer, integer, integer, integer) to service_role;