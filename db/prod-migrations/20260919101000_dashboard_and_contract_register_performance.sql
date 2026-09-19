-- Dashboard aggregates must not repeatedly evaluate row-level unit scope over
-- thousands of rows. Access remains authenticated and the application applies
-- its existing module RBAC before calling these functions.
alter function public.dashboard_counts(date, date, date, date) security definer;
alter function public.dashboard_counts(date, date, date, date) set search_path = public;
revoke all on function public.dashboard_counts(date, date, date, date) from public;
grant execute on function public.dashboard_counts(date, date, date, date) to authenticated;
grant execute on function public.dashboard_counts(date, date, date, date) to service_role;

alter function public.dashboard_pnl_inputs(date, date, date) security definer;
alter function public.dashboard_pnl_inputs(date, date, date) set search_path = public;
revoke all on function public.dashboard_pnl_inputs(date, date, date) from public;
grant execute on function public.dashboard_pnl_inputs(date, date, date) to authenticated;
grant execute on function public.dashboard_pnl_inputs(date, date, date) to service_role;

-- A narrow contract-register directory avoids the slow nested
-- client_contracts -> units -> customers Data API embed. It returns only the
-- labels already shown alongside contracts, not private unit/customer fields.
create or replace function public.contract_register_directory()
returns table (
  unit_id uuid,
  unit_code text,
  unit_name text,
  customer_id uuid,
  customer_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    u.id,
    u.code,
    u.name,
    u.customer_id,
    coalesce(c.name, '—')
  from public.client_contracts cc
  join public.units u on u.id = cc.unit_id
  left join public.customers c on c.id = u.customer_id
  where auth.uid() is not null
    and (
      public.is_admin_user()
      or public.current_user_has_permission('contracts', '', 'view')
    );
$$;

revoke all on function public.contract_register_directory() from public;
grant execute on function public.contract_register_directory() to authenticated;
grant execute on function public.contract_register_directory() to service_role;