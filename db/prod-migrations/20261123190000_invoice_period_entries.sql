-- Dashboard invoice parity: raw attendance for many sites, each over its OWN
-- invoice period, in one compact response. Runs as the caller (RLS applies),
-- so a scoped user only receives the sites they can already read. The browser
-- feeds these rows to the same invoice engine the single-site invoice uses.
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
people as (
  -- Profiles of everyone attended or posted at these sites (any home unit or
  -- status): the engine applies the invoice page's roster rules to them.
  select distinct ca.id, ca.unit_id, ca.is_enabled, ca.status, ca.employee_code, ca.full_name,
         ca.designation_id, ca.gender, ca.is_disabled, ca.preferred_joining_date
  from candidates ca
  where ca.id in (select candidate_id from cands)
     or ca.id in (select cu.candidate_id from candidate_units cu where cu.unit_id in (select unit_id from p))
),
des as (
  select designation_id, (row_number() over (order by designation_id)) - 1 as ix
  from (select distinct designation_id from ae where designation_id is not null) z
)
select jsonb_build_object(
  'c', (select coalesce(jsonb_agg(candidate_id order by ix), '[]'::jsonb) from cands),
  'd', (select coalesce(jsonb_agg(designation_id order by ix), '[]'::jsonb) from des),
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
