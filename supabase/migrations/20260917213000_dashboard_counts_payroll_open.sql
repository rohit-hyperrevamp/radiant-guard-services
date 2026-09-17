create or replace function public.dashboard_counts(p_start date, p_end date, p_today date, p_horizon date)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'orgs', (select count(*) from customers),
    'units', (select count(*) from units),
    'employees', (
      select count(*) from candidates
      where is_enabled and status in ('active', 'approved')
    ),
    'contractsActive', (
      select count(*) from client_contracts where status = 'active'
    ),
    'contractsExpiring', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
                 'id', c.id,
                 'contract_code', c.contract_code,
                 'end_date', c.end_date,
                 'unit_id', c.unit_id,
                 'status', c.status
               ) as x
        from client_contracts c
        where c.status = 'active'
          and c.end_date >= p_today
          and c.end_date <= p_horizon
        order by c.end_date
        limit 10
      ) s
    ), '[]'::jsonb),
    'vehicles', (select count(*) from vehicles),
    'fuelTotal', coalesce((
      select sum(coalesce(amount, 0)) from vehicle_fuel_entries
      where entry_date >= p_start and entry_date <= p_end
    ), 0),
    'items', (select count(*) from inv_items),
    'sheetCounts', (
      select jsonb_build_object(
        'approved', count(*) filter (where lower(coalesce(status, '')) = 'approved'),
        'pending',  count(*) filter (where lower(coalesce(status, '')) in ('submitted', 'pending')),
        'rejected', count(*) filter (where lower(coalesce(status, '')) = 'rejected'),
        'draft',    count(*) filter (where lower(coalesce(status, '')) not in ('approved', 'submitted', 'pending', 'rejected'))
      )
      from attendance_sheets
      where period_start <= p_end and period_end >= p_start
    ),
    'runCounts', (
      select jsonb_build_object(
        'approved', count(*) filter (where lower(coalesce(status, '')) = 'approved'),
        'pending',  count(*) filter (where lower(coalesce(status, '')) = 'submitted'),
        'rejected', count(*) filter (where lower(coalesce(status, '')) = 'rejected'),
        'draft',    count(*) filter (where lower(coalesce(status, '')) not in ('approved', 'submitted', 'rejected')),
        'processed', count(*) filter (where lower(coalesce(payroll_status, '')) = 'processed'),
        'open',      count(*) filter (where lower(coalesce(payroll_status, 'open')) <> 'processed')
      )
      from payroll_runs
      where period_start <= p_end and period_end >= p_start
    )
  );
$function$;
