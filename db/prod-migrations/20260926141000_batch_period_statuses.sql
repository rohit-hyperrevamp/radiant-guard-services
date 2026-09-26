-- Load attendance, payroll and invoice lifecycle status for mixed payroll
-- windows in one request. Source-table RLS remains authoritative.
create or replace function public.batch_period_statuses(p_periods jsonb)
returns table (
  unit_id uuid,
  attendance_status text,
  tally_invoice_path text,
  run_id uuid,
  run_status text,
  payroll_status text,
  invoice_status text,
  finalised boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct p.unit_id, p.period_start, p.period_end
    from jsonb_to_recordset(coalesce(p_periods, '[]'::jsonb))
      as p(unit_id uuid, period_start date, period_end date)
    where p.unit_id is not null
      and p.period_start is not null
      and p.period_end is not null
  )
  select
    r.unit_id,
    s.status as attendance_status,
    s.tally_invoice_path,
    pr.id as run_id,
    pr.status as run_status,
    pr.payroll_status,
    pr.invoice_status,
    (fi.unit_id is not null) as finalised
  from requested r
  left join public.attendance_sheets s
    on s.unit_id = r.unit_id
   and s.period_start = r.period_start
   and s.period_end = r.period_end
  left join public.payroll_runs pr
    on pr.unit_id = r.unit_id
   and pr.period_start = r.period_start
   and pr.period_end = r.period_end
  left join public.final_invoice_units fi
    on fi.unit_id = r.unit_id
   and fi.period_start = r.period_start
   and fi.period_end = r.period_end;
$$;

revoke all on function public.batch_period_statuses(jsonb) from public, anon;
grant execute on function public.batch_period_statuses(jsonb) to authenticated, service_role;