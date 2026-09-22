-- Complete the Control Center permission registry for tools added after the
-- original RBAC seed. Existing explicit rows are never changed.
begin;

with missing_submodules(sub_module_key) as (
  values
    ('public_holiday_manager'::text),
    ('migration_utility'::text),
    ('org_settings'::text),
    ('invoice_numbering'::text),
    ('mis_manager'::text)
), parent_permissions as (
  select
    rp.role_key,
    rp.can_view,
    rp.can_edit,
    rp.can_delete,
    rp.can_approve
  from public.role_permissions rp
  where rp.module_key = 'control_center'
    and rp.sub_module_key = ''
)
insert into public.role_permissions (
  role_key,
  module_key,
  sub_module_key,
  can_view,
  can_edit,
  can_delete,
  can_approve
)
select
  parent.role_key,
  'control_center',
  missing.sub_module_key,
  parent.can_view,
  parent.can_edit,
  parent.can_delete,
  parent.can_approve
from parent_permissions parent
cross join missing_submodules missing
on conflict (role_key, module_key, sub_module_key) do nothing;

commit;