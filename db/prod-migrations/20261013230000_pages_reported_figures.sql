-- Pages-reported figures: the numbers Pages actually paid/billed for a period.
-- Payroll and invoice screens show these in place of the live calculation for
-- that site + period (clearly labelled), without changing any calculation rule.
create table if not exists public.pages_reported_payroll (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  employee_code text not null,
  employee_name text,
  designation_name text,
  duties numeric not null default 0,
  ot_duties numeric not null default 0,
  gross numeric not null default 0,
  total_deductions numeric not null default 0,
  net_pay numeric not null default 0,
  earnings jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  source text not null default 'Pages wage register',
  created_at timestamptz not null default now(),
  unique (unit_id, period_start, period_end, employee_code)
);
create index if not exists pages_reported_payroll_unit_idx on public.pages_reported_payroll (unit_id, period_start);

create table if not exists public.pages_reported_invoices (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pdf_label text,
  pdf_duties numeric,
  taxable_value numeric not null default 0,
  source text not null default 'Pages tax invoice PDF',
  created_at timestamptz not null default now(),
  unique (unit_id, period_start, period_end)
);

alter table public.pages_reported_payroll enable row level security;
alter table public.pages_reported_invoices enable row level security;

drop policy if exists "payroll viewers read pages payroll" on public.pages_reported_payroll;
create policy "payroll viewers read pages payroll" on public.pages_reported_payroll
  for select to authenticated
  using ((select public.is_admin_user()) or (select public.current_user_module_access('payroll'::text, 'view'::text)));
drop policy if exists "admins manage pages payroll" on public.pages_reported_payroll;
create policy "admins manage pages payroll" on public.pages_reported_payroll
  for all to authenticated using ((select public.is_admin_user())) with check ((select public.is_admin_user()));

drop policy if exists "invoice viewers read pages invoices" on public.pages_reported_invoices;
create policy "invoice viewers read pages invoices" on public.pages_reported_invoices
  for select to authenticated
  using ((select public.is_admin_user()) or (select public.current_user_module_access('invoice'::text, 'view'::text)));
drop policy if exists "admins manage pages invoices" on public.pages_reported_invoices;
create policy "admins manage pages invoices" on public.pages_reported_invoices
  for all to authenticated using ((select public.is_admin_user())) with check ((select public.is_admin_user()));

grant select, insert, update, delete on public.pages_reported_payroll to authenticated;
grant select, insert, update, delete on public.pages_reported_invoices to authenticated;
grant all on public.pages_reported_payroll to service_role;
grant all on public.pages_reported_invoices to service_role;
