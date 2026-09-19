-- Extend contract_register_directory with the unit's billing state/city so the
-- Contracts register can filter by state and city without extra round-trips.
drop function if exists public.contract_register_directory();

create function public.contract_register_directory()
returns table (
  unit_id uuid,
  unit_code text,
  unit_name text,
  customer_id uuid,
  customer_name text,
  unit_state text,
  unit_city text
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
    coalesce(c.name, '—'),
    coalesce(u.billing_state, ''),
    coalesce(u.billing_city, '')
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
