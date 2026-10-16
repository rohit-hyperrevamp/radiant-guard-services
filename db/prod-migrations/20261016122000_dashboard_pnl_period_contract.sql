CREATE OR REPLACE FUNCTION public.dashboard_pnl_inputs(p_start date, p_end date, p_att_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with cur0 as (
  -- Same contract the payroll/invoice pages use for a period: an active or
  -- expired client contract overlapping it (latest start), else latest active.
  select distinct on (c.unit_id) c.id, c.unit_id, c.is_internal, 0 as pri, c.start_date
  from client_contracts c
  where c.status in ('active', 'expired') and c.record_type = 'client'
    and c.unit_id is not null and c.start_date <= p_end
    and (c.end_date is null or c.end_date >= p_start)
  order by c.unit_id, c.start_date desc, c.id
),
cur as (
  select id, unit_id, is_internal from cur0
  union all
  select distinct on (c.unit_id) c.id, c.unit_id, c.is_internal
  from client_contracts c
  where c.status = 'active' and c.record_type = 'client' and c.unit_id is not null
    and c.unit_id not in (select unit_id from cur0)
  order by c.unit_id, c.start_date desc, c.id
),
u as (
  select cur.id as contract_id,
         coalesce(cur.is_internal, false) as is_internal,
         un.id as unit_id,
         un.code as unit_code,
         un.name as unit_name,
         coalesce(un.epf_cap_enabled, true) as epf_cap_enabled,
         coalesce(cust.name, '-') as customer_name
  from cur
  join units un on un.id = cur.unit_id
  left join customers cust on cust.id = un.customer_id
),
roster as (
  select u.unit_id, ca.id as candidate_id, ca.designation_id
  from u
  join candidates ca on ca.unit_id = u.unit_id
  where ca.is_enabled and ca.status in ('active', 'approved')
  union
  select u.unit_id, ca.id as candidate_id, ca.designation_id
  from u
  join candidate_units cu on cu.unit_id = u.unit_id
  join candidates ca on ca.id = cu.candidate_id
  where ca.is_enabled and ca.status in ('active', 'approved')
),
att as (
  select distinct on (ae.unit_id, ae.candidate_id, ae.designation_id, ae.entry_date)
    ae.unit_id, ae.candidate_id, ae.designation_id, ae.code, ae.ot_hours, ae.entry_date,
    case when ae.shift_hours in (8, 12) then ae.shift_hours::int end as att_shift
  from attendance_entries ae
  where ae.entry_date >= p_start
    and ae.entry_date <= coalesce(p_att_end, p_end)
    and ae.unit_id in (select unit_id from u)
  order by ae.unit_id, ae.candidate_id, ae.designation_id, ae.entry_date,
           ae.updated_at desc nulls last, ae.id desc
),
hol as (
  select d::date as hdate
  from generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') d
  join public_holidays h on h.enabled
   and h.holiday_month = extract(month from d) and h.holiday_day = extract(day from d)
),
agg as (
  select a.unit_id, a.candidate_id, a.designation_id,
         max(a.att_shift) as att_shift,
         round(coalesce(sum(case when ac.code is not null and a.code <> 'PH' and ac.counts_as_present
                then coalesce(ac.day_value, 1) else 0 end), 0), 2) as p_days,
         round(coalesce(sum(case when ac.code is not null and a.code = 'PH'
                then coalesce(un.ph_day_value, ac.day_value, 1) else 0 end), 0), 2) as ph_days,
         round(coalesce(sum(case when ac.code is not null and a.code <> 'PH'
                and not ac.counts_as_present and ac.is_paid
                then coalesce(ac.day_value, 1) else 0 end), 0), 2) as other_paid_days,
         round(coalesce(sum(coalesce(a.ot_hours, 0)), 0), 2) as ot_days,
         round(coalesce(sum(case when ac.code is not null and coalesce(un.ph_enabled, false)
                and a.entry_date in (select hdate from hol)
                and (ca.preferred_joining_date is null or a.entry_date >= ca.preferred_joining_date)
                then coalesce(nullif(un.ph_multiplier, 0), 1) else 0 end), 0), 2) as unit_ph_days
  from att a
  join units un on un.id = a.unit_id
  left join candidates ca on ca.id = a.candidate_id
  left join attendance_codes ac on ac.code = a.code and ac.enabled
  group by a.unit_id, a.candidate_id, a.designation_id
),
keys as (
  -- Everyone with attendance at the unit counts (relievers, transfers,
  -- unmapped staff) — same roster rule as the payroll page.
  select unit_id, candidate_id, designation_id from roster
  union
  select g.unit_id, g.candidate_id, g.designation_id from agg g
),
pairs0 as (
  select k.unit_id, k.candidate_id, k.designation_id,
         coalesce(g.att_shift, cu.shift_hours::int) as shift,
         coalesce(g.p_days, 0) as p_days,
         coalesce(g.ph_days, 0) as ph_days,
         coalesce(g.unit_ph_days, 0) as unit_ph_days,
         coalesce(g.other_paid_days, 0) as other_paid_days,
         coalesce(g.ot_days, 0) as ot_days,
         (ca.designation_id is not distinct from k.designation_id) as is_home
  from keys k
  left join agg g on g.unit_id = k.unit_id and g.candidate_id = k.candidate_id
   and g.designation_id is not distinct from k.designation_id
  left join candidates ca on ca.id = k.candidate_id
  left join lateral (select c2.shift_hours from candidate_units c2
    where c2.unit_id = k.unit_id and c2.candidate_id = k.candidate_id and c2.shift_hours is not null
    limit 1) cu on true
),
pairs as (
  -- Unit PH credit lands on one line per employee (attended home role first).
  select p.*,
    case when row_number() over (partition by p.unit_id, p.candidate_id
           order by (p.p_days + p.ph_days + p.ot_days > 0) desc, p.is_home desc, p.designation_id) = 1
         then p.unit_ph_days else 0 end as carrier_ph
  from pairs0 p
),
strength as (
  select unit_id, count(distinct candidate_id) as actual_strength
  from roster group by unit_id
),
res as (
  select cr.contract_id, cr.designation_id, cr.quantity, cr.components,
         cr.benefits, cr.deductions, cr.employer_contributions,
         cr.payroll_day_base_id, cr.shift_hours
  from contract_resources cr
  where cr.contract_id in (select contract_id from u)
)
select jsonb_build_object(
  'units', coalesce((
    select jsonb_agg(jsonb_build_object(
      'unit_id', u.unit_id,
      'unit_code', u.unit_code,
      'unit_name', u.unit_name,
      'customer_name', u.customer_name,
      'epf_cap_enabled', u.epf_cap_enabled,
      'contract_id', u.contract_id,
      'is_internal', u.is_internal,
      'actual_strength', coalesce(s.actual_strength, 0)
    ))
    from u left join strength s on s.unit_id = u.unit_id
  ), '[]'::jsonb),
  'resources', coalesce((
    select jsonb_agg(jsonb_build_object(
      'contract_id', res.contract_id,
      'designation_id', res.designation_id,
      'quantity', res.quantity,
      'components', res.components,
      'benefits', res.benefits,
      'deductions', res.deductions,
      'employer_contributions', res.employer_contributions,
      'payroll_day_base_id', res.payroll_day_base_id,
      'shift_hours', res.shift_hours
    )) from res
  ), '[]'::jsonb),
  'pairs', coalesce((
    select jsonb_agg(jsonb_build_object(
      'unit_id', p.unit_id,
      'candidate_id', p.candidate_id,
      'designation_id', p.designation_id,
      'p_days', p.p_days,
      'ph_days', p.ph_days + p.carrier_ph,
      'shift', p.shift,
      'other_paid_days', p.other_paid_days,
      'ot_days', p.ot_days
    )) from pairs p where p.designation_id is not null
  ), '[]'::jsonb),
  'day_bases', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'method', b.method,
      'fixed_days', b.fixed_days,
      'weekly_off_day', b.weekly_off_day,
      'included_weekdays', b.included_weekdays
    ))
    from payroll_day_bases b
    where b.id in (select payroll_day_base_id from res where payroll_day_base_id is not null)
  ), '[]'::jsonb)
);
$function$;
NOTIFY pgrst, 'reload schema';
