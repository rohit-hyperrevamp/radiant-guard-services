-- Invoice/payroll viewers (e.g. Finance) must read the guards behind an invoice;
-- previously only Employee-module viewers could, so invoices showed "No billable resources".
create policy "Invoice and payroll viewers read candidates"
on public.candidates for select to authenticated
using (
  ((select current_user_has_permission('invoice','','view')) or (select current_user_has_permission('payroll','','view')))
  and (coalesce((select current_user_role_key()),'') not in ('accounts','hr_executive','field_officer','guard')
       or unit_id = any(coalesce((select current_user_unit_ids()),'{}'::uuid[])))
  and ((select is_admin_user()) or not (select current_user_has_branch_scope())
       or unit_id = any(coalesce((select current_user_unit_ids()),'{}'::uuid[])))
);
