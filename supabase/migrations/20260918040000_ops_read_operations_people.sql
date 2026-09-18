-- Operations leaders (field_sense viewers) must see the operations people they manage.
drop policy if exists "Field sense viewers read operations people" on public.candidates;
create policy "Field sense viewers read operations people"
on public.candidates for select to authenticated
using (
  status = any (array['approved','active'])
  and role_key = any (array['field_officer','operations','operations_manager','vp_operations','branch_manager'])
  and (select public.current_user_has_permission('field_sense','','view'))
);
