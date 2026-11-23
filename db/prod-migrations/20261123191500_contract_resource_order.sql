-- Contract lines for the invoice engine in stored (ctid) order: the invoice
-- page reads a contract's lines unordered, and when a role has two lines for
-- the same shift the later one prices the invoice. Runs as the caller (RLS).
drop function if exists public.contract_resource_order(uuid[]);
create or replace function public.invoice_contract_resources(p_contract_ids uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cr.id, 'contract_id', cr.contract_id, 'designation_id', cr.designation_id, 'quantity', cr.quantity,
    'components', cr.components, 'benefits', cr.benefits, 'deductions', cr.deductions,
    'employer_contributions', cr.employer_contributions, 'payroll_day_base_id', cr.payroll_day_base_id,
    'billing_day_base_id', cr.billing_day_base_id, 'invoice_present_cap', cr.invoice_present_cap,
    'shift_hours', cr.shift_hours, 'ot_multiplier', cr.ot_multiplier, 'ot_basis', cr.ot_basis,
    'ot_formula', cr.ot_formula, 'ot_esi', cr.ot_esi, 'ot_hourly_rate', cr.ot_hourly_rate,
    'ot_hourly_esic', cr.ot_hourly_esic, 'round_off_final', cr.round_off_final, 'round_off_totals', cr.round_off_totals
  ) order by cr.contract_id, cr.ctid), '[]'::jsonb)
  from contract_resources cr
  where cr.contract_id = any(coalesce(p_contract_ids, '{}'::uuid[]));
$$;
revoke all on function public.invoice_contract_resources(uuid[]) from public, anon;
grant execute on function public.invoice_contract_resources(uuid[]) to authenticated, service_role;
