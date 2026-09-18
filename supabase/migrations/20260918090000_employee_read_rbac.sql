drop policy if exists "Employee viewers read all candidates" on public.candidates;
create policy "Employee viewers read all candidates"
on public.candidates
for select
to authenticated
using (
  (select public.current_user_has_permission('employees', '', 'view'))
  and coalesce((select public.current_user_role_key()), '') not in ('field_officer', 'branch_manager')
);
