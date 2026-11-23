-- Dashboard invoice parity: everything the invoice engine needs for many
-- sites, each over its OWN invoice period, in one compact response per batch.
-- Runs as the caller (RLS applies), so a scoped user only receives what the
-- single-site invoice page would show them. The browser feeds these rows to
-- the same invoice engine the single-site invoice uses.
create or replace function public.invoice_period_entries(p_units jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with p as (
  select distinct (x->>'u')::uuid as unit_id, (x->>'s')::date as s, (x->>'e')::date as e
  from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) x
),
ae as (
  select a.id, a.unit_id, a.candidate_id, a.designation_id, a.entry_date, a.code,
         a.ot_hours, a.shift_hours, a.is_reliever, p.s, p.e
  from p
  join attendance_entries a
    on a.unit_id = p.unit_id and a.entry_date >= p.s and a.entry_date <= p.e
),
cands as (
  select candidate_id, (row_number() over (order by candidate_id)) - 1 as ix
  from (select distinct candidate_id from ae) z
),
des as (
  select designation_id, (row_number() over (order by designation_id)) - 1 as ix
  from (select distinct designation_id from ae where designation_id is not null) z
),
people as (
  -- Profiles of everyone attended or posted at these sites (any home unit or
  -- status): the engine applies the invoice page's roster rules to them.
  select distinct ca.id, ca.unit_id, ca.is_enabled, ca.status, ca.employee_code, ca.full_name,
         ca.designation_id, ca.gender, ca.is_disabled, ca.preferred_joining_date
  from candidates ca
  where ca.id in (select candidate_id from cands)
     or ca.id in (select cu.candidate_id from candidate_units cu where cu.unit_id in (select unit_id from p))
)
select jsonb_build_object(
  'site', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', un.id, 'code', un.code, 'name', un.name, 'customer_id', un.customer_id,
      'epf_cap_enabled', un.epf_cap_enabled, 'billing_state', un.billing_state,
      'billing_pincode', un.billing_pincode, 'pt_state', un.pt_state,
      'ph_enabled', un.ph_enabled, 'ph_multiplier', un.ph_multiplier, 'ph_day_value', un.ph_day_value,
      'ph_excluded_candidate_ids', un.ph_excluded_candidate_ids, 'ph_excluded_days', un.ph_excluded_days,
      'customer_name', cu.name, 'customer_invoice_split', cu.invoice_split)), '[]'::jsonb)
    from units un left join customers cu on cu.id = un.customer_id
    where un.id in (select unit_id from p)),
  'contracts', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'unit_id', c.unit_id, 'status', c.status, 'start_date', c.start_date,
      'end_date', c.end_date, 'created_at', c.created_at, 'billing_type_id', c.billing_type_id,
      'gst_option', c.gst_option, 'payroll_window_id', c.payroll_window_id,
      'wo_as_present', c.wo_as_present, 'exact_day_rate', c.exact_day_rate,
      'invoice_split', c.invoice_split, 'invoice_ed_mode', c.invoice_ed_mode, 'is_internal', c.is_internal)), '[]'::jsonb)
    from client_contracts c
    join p on p.unit_id = c.unit_id
    where c.record_type = 'client' and c.status in ('active', 'expired')
      -- Only contracts that can govern the period: overlapping it, or active (fallback).
      and (c.status = 'active' or (c.start_date <= p.e and (c.end_date is null or c.end_date >= p.s)))),
  -- Home-unit roster in stored order (the invoice page reads it unordered).
  'primary', (select coalesce(jsonb_agg(jsonb_build_array(ca.id, ca.unit_id, ca.employee_code, ca.full_name,
      ca.designation_id, ca.gender, ca.is_disabled, ca.preferred_joining_date) order by ca.unit_id, ca.ctid), '[]'::jsonb)
    from candidates ca
    where ca.unit_id in (select unit_id from p) and ca.is_enabled and ca.status = 'active'),
  'scopes', (select coalesce(jsonb_agg(jsonb_build_array(sa.scope_id, sa.candidate_id)), '[]'::jsonb)
    from employee_scope_assignments sa
    where sa.scope_type = 'unit' and sa.scope_id in (select unit_id::text from p)),
  'extras', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    from invoice_extra_charges x where x.unit_id in (select unit_id from p)),
  'c', (select coalesce(jsonb_agg(candidate_id order by ix), '[]'::jsonb) from cands),
  'd', (select coalesce(jsonb_agg(designation_id order by ix), '[]'::jsonb) from des),
  -- Postings in stored order: with two postings (8h and 12h) for one person
  -- the later one sets the posting shift, exactly as on the invoice page.
  'links', (select coalesce(jsonb_agg(jsonb_build_array(cu.unit_id, cu.candidate_id, cu.shift_hours) order by cu.unit_id, cu.ctid), '[]'::jsonb)
            from candidate_units cu where cu.unit_id in (select unit_id from p)),
  'people', (select coalesce(jsonb_agg(jsonb_build_array(id, unit_id, is_enabled, status, employee_code, full_name,
             designation_id, gender, is_disabled, preferred_joining_date)), '[]'::jsonb) from people),
  'units', (
    select coalesce(jsonb_agg(jsonb_build_object('u', q.unit_id, 's', q.s, 'e', q.e, 'r', q.rows)), '[]'::jsonb)
    from (
      select ae.unit_id, ae.s, ae.e,
             jsonb_agg(jsonb_build_array(
               c.ix, coalesce(d.ix, -1), ae.entry_date - ae.s, ae.code, ae.ot_hours,
               ae.shift_hours, case when ae.is_reliever then 1 else 0 end
             ) order by ae.entry_date, ae.id) as rows
      from ae
      join cands c on c.candidate_id = ae.candidate_id
      left join des d on d.designation_id = ae.designation_id
      group by ae.unit_id, ae.s, ae.e
    ) q
  )
);
$$;

revoke all on function public.invoice_period_entries(jsonb) from public, anon;
grant execute on function public.invoice_period_entries(jsonb) to authenticated, service_role;
