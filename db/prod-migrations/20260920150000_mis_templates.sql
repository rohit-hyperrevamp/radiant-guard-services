-- Configurable MIS per organization: column definition per customer, plus
-- optional per-site custom values printed in that organization's MIS sheet.
begin;

create table if not exists public.mis_templates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mis_template_columns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.mis_templates(id) on delete cascade,
  header text not null,
  sort_order integer not null default 0,
  source text not null default 'custom' check (source in ('system','custom')),
  system_key text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mis_unit_values (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.mis_templates(id) on delete cascade,
  column_id uuid not null references public.mis_template_columns(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (column_id, unit_id)
);

create unique index if not exists mis_templates_one_active_per_customer
  on public.mis_templates(customer_id) where enabled;
create index if not exists mis_template_columns_template_idx on public.mis_template_columns(template_id, sort_order);
create index if not exists mis_unit_values_unit_idx on public.mis_unit_values(unit_id);

grant select, insert, update, delete on public.mis_templates to authenticated;
grant select, insert, update, delete on public.mis_template_columns to authenticated;
grant select, insert, update, delete on public.mis_unit_values to authenticated;
grant all on public.mis_templates to service_role;
grant all on public.mis_template_columns to service_role;
grant all on public.mis_unit_values to service_role;

alter table public.mis_templates enable row level security;
alter table public.mis_template_columns enable row level security;
alter table public.mis_unit_values enable row level security;

-- Every signed-in user may read the definitions (the MIS export needs them);
-- writing is gated on the Control Center → MIS permission.
do $$
declare t text;
begin
  foreach t in array array['mis_templates','mis_template_columns','mis_unit_values'] loop
    execute format('drop policy if exists "mis read" on public.%I', t);
    execute format('create policy "mis read" on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists "mis insert" on public.%I', t);
    execute format($f$create policy "mis insert" on public.%I for insert to authenticated
      with check ((select public.current_user_has_permission('control_center','mis_manager','edit')))$f$, t);
    execute format('drop policy if exists "mis update" on public.%I', t);
    execute format($f$create policy "mis update" on public.%I for update to authenticated
      using ((select public.current_user_has_permission('control_center','mis_manager','edit')))
      with check ((select public.current_user_has_permission('control_center','mis_manager','edit')))$f$, t);
    execute format('drop policy if exists "mis delete" on public.%I', t);
    execute format($f$create policy "mis delete" on public.%I for delete to authenticated
      using ((select public.current_user_has_permission('control_center','mis_manager','delete')))$f$, t);
  end loop;
end $$;

drop trigger if exists mis_templates_set_updated_at on public.mis_templates;
create trigger mis_templates_set_updated_at before update on public.mis_templates
  for each row execute function public.set_updated_at();
drop trigger if exists mis_template_columns_set_updated_at on public.mis_template_columns;
create trigger mis_template_columns_set_updated_at before update on public.mis_template_columns
  for each row execute function public.set_updated_at();
drop trigger if exists mis_unit_values_set_updated_at on public.mis_unit_values;
create trigger mis_unit_values_set_updated_at before update on public.mis_unit_values
  for each row execute function public.set_updated_at();

-- Seed the existing L&T layout so nothing changes for that organization.
insert into public.mis_templates (customer_id, name, enabled)
select c.id, 'L&T Finance MIS', true
from public.customers c
where c.code = 'ORG259'
  and not exists (select 1 from public.mis_templates t where t.customer_id = c.id)
;

insert into public.mis_template_columns (template_id, header, sort_order, source, system_key)
select t.id, x.header, x.ord, 'system', x.key
from public.mis_templates t
join public.customers c on c.id = t.customer_id and c.code = 'ORG259'
cross join (values
  ('Sr. No','sr_no',1),
  ('Invoice No','invoice_no',2),
  ('Invoice Date','invoice_date',3),
  ('Emp Code','emp_code',4),
  ('Employee Name','employee_name',5),
  ('Regular/ Reliever Guard','regular_reliever',6),
  ('DOJ','doj',7),
  ('Entity','entity',8),
  ('Designation','designation',9),
  ('Location/Branch Name','branch_name',10),
  ('State','state',11),
  ('Branch SAP Code','branch_sap_code',12),
  ('Zone','zone',13),
  ('Month Days','month_days',14),
  ('Month Rate','month_rate',15),
  ('Billing Rate','billing_rate',16),
  ('Billing Rate (Per Day)','billing_rate_per_day',17),
  ('OT Rate','ot_rate',18),
  ('Working days','working_days',19),
  ('OT and Night duties','ot_duties',20),
  ('OT Amount','ot_amount',21),
  ('Working days Billing with OT','working_days_billing_with_ot',22),
  ('Total Regular Billing Amt','total_regular_billing',23),
  ('OT & Night Duty Billing Amt','ot_billing',24),
  ('Total Billing Amt','total_billing',25),
  ('CGST @9%','cgst',26),
  ('SGST @9%','sgst',27),
  ('IGST @18%','igst',28),
  ('Grand Total','grand_total',29)
) as x(header, key, ord)
where not exists (select 1 from public.mis_template_columns mc where mc.template_id = t.id);

commit;
