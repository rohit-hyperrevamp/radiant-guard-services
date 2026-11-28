-- Client holidays: a client/site's own dated holiday (e.g. 14 Sep 2026 for one client)
-- on top of the global public_holidays list (26 Jan, 1 May, 15 Aug, 2 Oct).
-- They feed the existing unit PH credit everywhere the global list does: an employee
-- present on the holiday earns the site's Inclusions credit (units.ph_enabled,
-- units.ph_multiplier: +1 / +1.5 / +2), shown as "PH" in the ED row of the sheet.
-- Kept in a separate table so a reader that does not know about client scope can
-- never apply one client's holiday to every client.

create table if not exists public.client_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  customer_id uuid references public.customers(id) on delete set null,
  unit_ids uuid[] not null default '{}',
  enabled boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists client_holidays_date_idx on public.client_holidays(holiday_date);
create index if not exists client_holidays_units_idx on public.client_holidays using gin(unit_ids);

alter table public.client_holidays enable row level security;
drop policy if exists "Authenticated read client_holidays" on public.client_holidays;
create policy "Authenticated read client_holidays" on public.client_holidays for select to authenticated using (true);
drop policy if exists "Admins manage client_holidays" on public.client_holidays;
create policy "Admins manage client_holidays" on public.client_holidays for all to authenticated
  using (is_admin_user() or not current_user_has_branch_scope())
  with check (is_admin_user() or not current_user_has_branch_scope());

drop trigger if exists client_holidays_set_update on public.client_holidays;
create trigger client_holidays_set_update before update on public.client_holidays for each row execute function set_updated_at();
drop trigger if exists zz_audit on public.client_holidays;
create trigger zz_audit after insert or update or delete on public.client_holidays for each row execute function public.audit_row_change('Client Holidays');
drop trigger if exists zz_finance_insert on public.client_holidays;
create trigger zz_finance_insert after insert on public.client_holidays referencing new table as new_rows for each statement execute function dirty_finance_totals();
drop trigger if exists zz_finance_update on public.client_holidays;
create trigger zz_finance_update after update on public.client_holidays referencing old table as old_rows new table as new_rows for each statement execute function dirty_finance_totals();
drop trigger if exists zz_finance_delete on public.client_holidays;
create trigger zz_finance_delete after delete on public.client_holidays referencing old table as old_rows for each statement execute function dirty_finance_totals();

-- Dashboard profitability credits client holidays like the payroll/invoice engines.
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
  order by c.unit_id, c.start_date desc, c.status asc, c.created_at desc
),
cur as (
  select id, unit_id, is_internal from cur0
  union all
  (select distinct on (c.unit_id) c.id, c.unit_id, c.is_internal
   from client_contracts c
   where c.status = 'active' and c.record_type = 'client' and c.unit_id is not null
     and c.unit_id not in (select unit_id from cur0)
   order by c.unit_id, c.start_date desc, c.created_at desc)
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
  select distinct on (ae.unit_id, ae.candidate_id, ae.designation_id, ae.shift_hours, ae.entry_date)
    ae.unit_id, ae.candidate_id, ae.designation_id, ae.code, ae.ot_hours, ae.entry_date,
    case when ae.shift_hours in (8, 10, 12) then ae.shift_hours::int end as att_shift
  from attendance_entries ae
  where ae.entry_date >= p_start
    and ae.entry_date <= coalesce(p_att_end, p_end)
    and ae.unit_id in (select unit_id from u)
  order by ae.unit_id, ae.candidate_id, ae.designation_id, ae.shift_hours, ae.entry_date,
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
         a.att_shift,
         round(coalesce(sum(case when ac.code is not null and a.code <> 'PH' and ac.counts_as_present
                then coalesce(ac.day_value, 1) else 0 end), 0), 4) as p_days,
         round(coalesce(sum(case when ac.code is not null and a.code = 'PH'
                then coalesce(un.ph_day_value, ac.day_value, 1) else 0 end), 0), 4) as ph_days,
         round(coalesce(sum(case when ac.code is not null and a.code <> 'PH'
                and not ac.counts_as_present and ac.is_paid
                then coalesce(ac.day_value, 1) else 0 end), 0), 4) as other_paid_days,
         round(coalesce(sum(coalesce(a.ot_hours, 0)), 0), 4) as ot_days,
         round(coalesce(sum(case when ac.code is not null and coalesce(un.ph_enabled, false)
                and (a.entry_date in (select hdate from hol)
                     or exists (select 1 from client_holidays ch where ch.enabled
                                and ch.holiday_date = a.entry_date and a.unit_id = any(ch.unit_ids)))
                and (ca.preferred_joining_date is null or a.entry_date >= ca.preferred_joining_date)
                then coalesce(nullif(un.ph_multiplier, 0), 1) else 0 end), 0), 4) as unit_ph_days
  from att a
  join units un on un.id = a.unit_id
  left join candidates ca on ca.id = a.candidate_id
  left join attendance_codes ac on ac.code = a.code and ac.enabled
  group by a.unit_id, a.candidate_id, a.designation_id, a.att_shift
),
keys as (
  -- Everyone with attendance at the unit counts (relievers, transfers,
  -- unmapped staff) — same roster rule as the payroll page.
  -- One key per attended shift line; roster-only people get one line.
  select g.unit_id, g.candidate_id, g.designation_id, g.att_shift from agg g
  union
  select r.unit_id, r.candidate_id, r.designation_id, null::int from roster r
  where not exists (select 1 from agg g where g.unit_id = r.unit_id
    and g.candidate_id = r.candidate_id and g.designation_id is not distinct from r.designation_id)
),
pairs0 as (
  select k.unit_id, k.candidate_id, k.designation_id,
         coalesce(k.att_shift, cu.shift_hours::int) as shift,
         coalesce(g.p_days, 0) as p_days,
         coalesce(g.ph_days, 0) as ph_days,
         coalesce(g.unit_ph_days, 0) as unit_ph_days,
         coalesce(g.other_paid_days, 0) as other_paid_days,
         coalesce(g.ot_days, 0) as ot_days,
         (ca.designation_id is not distinct from k.designation_id) as is_home
  from keys k
  left join agg g on g.unit_id = k.unit_id and g.candidate_id = k.candidate_id
   and g.designation_id is not distinct from k.designation_id
   and g.att_shift is not distinct from k.att_shift
  left join candidates ca on ca.id = k.candidate_id
  left join lateral (select c2.shift_hours from candidate_units c2
    where c2.unit_id = k.unit_id and c2.candidate_id = k.candidate_id and c2.shift_hours is not null
    limit 1) cu on true
),
pairs as (
  -- Unit PH credit lands on one line per employee (attended home role first).
  select p.*,
    case when row_number() over (partition by p.unit_id, p.candidate_id
           order by (p.p_days + p.ph_days + p.ot_days > 0) desc, p.is_home desc, p.designation_id, p.shift nulls last) = 1
         then p.unit_ph_days else 0 end as carrier_ph
  from pairs0 p
),
strength as (
  select unit_id, count(distinct candidate_id) as actual_strength
  from roster group by unit_id
),
res as (
  select cr.id, cr.contract_id, cr.designation_id, cr.quantity, cr.components,
         cr.benefits, cr.deductions, cr.employer_contributions,
         cr.payroll_day_base_id, cr.shift_hours, cr.billing_day_base_id,
         cr.invoice_present_cap, cr.ot_multiplier, cr.ot_basis, cr.ot_formula, cr.ot_esi,
         cr.ot_hourly_rate, cr.ot_hourly_esic, cr.round_off_final, cr.round_off_totals
  from contract_resources cr
  where cr.contract_id in (select contract_id from u)
)
select json_build_object(
  'units', coalesce((
    select json_agg(json_build_object(
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
  ), '[]'::json),
  'resources', coalesce((
    select json_agg(json_build_object(
      'id', res.id,
      'contract_id', res.contract_id,
      'designation_id', res.designation_id,
      'quantity', res.quantity,
      'components', res.components,
      'benefits', res.benefits,
      'deductions', res.deductions,
      'employer_contributions', res.employer_contributions,
      'payroll_day_base_id', res.payroll_day_base_id,
      'shift_hours', res.shift_hours,
      'billing_day_base_id', res.billing_day_base_id,
      'invoice_present_cap', res.invoice_present_cap,
      'ot_multiplier', res.ot_multiplier,
      'ot_basis', res.ot_basis,
      'ot_formula', res.ot_formula,
      'ot_esi', res.ot_esi,
      'ot_hourly_rate', res.ot_hourly_rate,
      'ot_hourly_esic', res.ot_hourly_esic,
      'round_off_final', res.round_off_final,
      'round_off_totals', res.round_off_totals
    )) from res
  ), '[]'::json),
  'pairs', coalesce((
    select json_agg(json_build_object(
      'unit_id', p.unit_id,
      'candidate_id', p.candidate_id,
      'designation_id', p.designation_id,
      'p_days', p.p_days,
      'ph_days', p.ph_days + p.carrier_ph,
      'shift', p.shift,
      'other_paid_days', p.other_paid_days,
      'ot_days', p.ot_days
    )) from pairs p where p.designation_id is not null
  ), '[]'::json),
  'day_bases', coalesce((
    select json_agg(json_build_object(
      'id', b.id,
      'method', b.method,
      'fixed_days', b.fixed_days,
      'weekly_off_day', b.weekly_off_day,
      'included_weekdays', b.included_weekdays
    ))
    from payroll_day_bases b
    where b.id in (select payroll_day_base_id from res where payroll_day_base_id is not null)
  ), '[]'::json)
)::jsonb;
$function$;

-- Finance totals: a client holiday re-prices only the sites and periods it touches.
CREATE OR REPLACE FUNCTION public.dirty_finance_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE affected jsonb; BEGIN
 IF TG_OP='INSERT' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO affected FROM new_rows r;
 ELSIF TG_OP='DELETE' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO affected FROM old_rows r;
 ELSE SELECT coalesce(jsonb_agg(j),'[]') INTO affected FROM (SELECT to_jsonb(r) j FROM new_rows r UNION SELECT to_jsonb(r) FROM old_rows r) x; END IF;
 IF affected='[]'::jsonb THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='candidates' THEN
 IF NOT EXISTS(SELECT 1 FROM new_rows n JOIN old_rows o ON n.id=o.id WHERE
 (to_jsonb(n)-ARRAY['updated_at','last_seen_at','last_location_at','latitude','longitude','photo_url','photo_thumb_url']) IS DISTINCT FROM
 (to_jsonb(o)-ARRAY['updated_at','last_seen_at','last_location_at','latitude','longitude','photo_url','photo_thumb_url'])) THEN RETURN NULL; END IF;
 END IF;
 IF TG_TABLE_NAME='attendance_entries' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
 AND (r->>'entry_date')::date BETWEEN t.period_start AND t.period_end);
 ELSIF TG_TABLE_NAME IN ('attendance_sheets','payroll_runs','final_invoice_units','invoice_extra_charges') THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
 AND ((r->>'period_end') IS NULL OR (r->>'period_end')::date=t.period_end));
 ELSIF TG_TABLE_NAME='payroll_run_snapshots' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r
 LEFT JOIN public.payroll_runs pr ON pr.id=(r->>'payroll_run_id')::uuid
 WHERE (pr.id IS NOT NULL AND t.period_start<=pr.period_end AND t.period_end>=pr.period_start)
 OR (pr.id IS NULL AND (r->>'unit_id')::uuid=t.unit_id));
 ELSIF TG_TABLE_NAME='pt_site_allocations' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r
 WHERE (r->>'period_year') IS NOT NULL AND (r->>'period_month') IS NOT NULL
 AND date_trunc('month',t.period_end)::date=make_date((r->>'period_year')::int,(r->>'period_month')::int,1));
 ELSIF TG_TABLE_NAME IN ('candidates','candidate_units','employee_wages','employee_scope_assignments','additions','deductions') THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE (r->>'unit_id')::uuid=t.unit_id
 OR EXISTS(SELECT 1 FROM public.attendance_entries a WHERE a.unit_id=t.unit_id
 AND a.entry_date BETWEEN t.period_start AND t.period_end
 AND a.candidate_id=coalesce((r->>'candidate_id')::uuid,CASE WHEN TG_TABLE_NAME='candidates' THEN (r->>'id')::uuid END)));
 ELSIF TG_TABLE_NAME='contract_resources' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE t.unit_id IN (SELECT c.unit_id FROM public.client_contracts c JOIN jsonb_array_elements(affected) r ON c.id=(r->>'contract_id')::uuid);
 ELSIF TG_TABLE_NAME IN ('units','client_contracts') THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r WHERE t.unit_id=CASE WHEN TG_TABLE_NAME='units' THEN (r->>'id')::uuid ELSE (r->>'unit_id')::uuid END);
 ELSIF TG_TABLE_NAME='customers' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE t.unit_id IN (SELECT u.id FROM public.units u JOIN jsonb_array_elements(affected) r ON u.customer_id=(r->>'id')::uuid);
 ELSIF TG_TABLE_NAME='client_holidays' THEN
 UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(affected) r, jsonb_array_elements_text(coalesce(r->'unit_ids','[]'::jsonb)) uid
   WHERE uid::uuid=t.unit_id AND (r->>'holiday_date')::date BETWEEN t.period_start AND t.period_end);
 ELSIF TG_TABLE_NAME IN ('final_invoices','contract_rate_revisions','allowance_types','cost_components','payroll_day_bases','billing_day_bases','attendance_codes','professional_tax_slabs','pincode_ranges','labour_welfare_funds','public_holidays','addition_types') THEN
 UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL WHERE true;
 ELSE
 RETURN NULL;
 END IF;
 PERFORM public.dispatch_finance_refresh(); RETURN NULL;
END $function$;
