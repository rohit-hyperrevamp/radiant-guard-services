begin;

-- Evaluate identity/scope helpers once per statement instead of once per row.
-- This preserves the same RBAC and branch boundaries while preventing dashboard
-- aggregates over units, attendance and payroll from timing out.
drop policy if exists "Scoped read units" on public.units;
create policy "Scoped read units"
on public.units for select to public
using (
  (select public.is_admin_user())
  or (select public.current_user_is_inventory_manager())
  or coalesce((select public.current_user_role_key()), '') = any (array['hr','leadership','operations_manager','vp_operations'])
  or id in (select unnest((select public.current_user_unit_ids())))
  or not (select public.current_user_has_branch_scope())
  or branch_id is null
  or branch_id::text in (select public.current_user_branch_scope_ids())
);

drop policy if exists "Scoped read attendance_sheets" on public.attendance_sheets;
create policy "Scoped read attendance_sheets"
on public.attendance_sheets for select to public
using (
  (select public.is_admin_user())
  or not (select public.current_user_has_branch_scope())
  or public.is_unit_in_current_user_branch(unit_id)
);

drop policy if exists "Scoped read payroll_runs" on public.payroll_runs;
create policy "Scoped read payroll_runs"
on public.payroll_runs for select to authenticated
using (
  (select public.is_admin_user())
  or not (select public.current_user_has_branch_scope())
  or public.is_unit_in_current_user_branch(unit_id)
);

commit;
