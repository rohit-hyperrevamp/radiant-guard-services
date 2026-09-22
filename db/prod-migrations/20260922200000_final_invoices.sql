-- Final invoices: the moment a unit's (or a set of units') invoice is finalised,
-- a number is consumed from that state's series and can never be released.
begin;

create table if not exists public.final_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  state_code text not null,
  fiscal_year text not null,
  month_code text not null,
  sequence integer not null,
  client_token text,
  customer_id uuid references public.customers(id) on delete set null,
  party_name text,
  billing_state text,
  invoice_date date not null,
  period_start date not null,
  period_end date not null,
  taxable_value numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_value numeric(14,2) not null default 0,
  registry_id uuid references public.invoice_number_registry(id) on delete set null,
  generated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_invoice_units (
  id uuid primary key default gen_random_uuid(),
  final_invoice_id uuid not null references public.final_invoices(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  unique (unit_id, period_start, period_end)
);

create index if not exists final_invoices_state_idx on public.final_invoices(state_code, fiscal_year, sequence desc);
create index if not exists final_invoice_units_unit_idx on public.final_invoice_units(unit_id, period_start);

grant select, insert, update on public.final_invoices to authenticated;
grant select, insert on public.final_invoice_units to authenticated;
grant all on public.final_invoices to service_role;
grant all on public.final_invoice_units to service_role;

alter table public.final_invoices enable row level security;
alter table public.final_invoice_units enable row level security;

drop policy if exists "final invoices read" on public.final_invoices;
create policy "final invoices read" on public.final_invoices for select to authenticated using (true);
drop policy if exists "final invoice units read" on public.final_invoice_units;
create policy "final invoice units read" on public.final_invoice_units for select to authenticated using (true);
-- Rows are only ever written by generate_final_invoice() (security definer);
-- there is deliberately no insert/update/delete policy for end users.

drop trigger if exists final_invoices_set_updated_at on public.final_invoices;
create trigger final_invoices_set_updated_at before update on public.final_invoices
  for each row execute function public.set_updated_at();

-- Billing state name -> series state code. States without their own registration
-- bill from the default (Maharashtra head office) series.
create or replace function public.resolve_invoice_series_state(_state_name text, _fiscal_year text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.state_code from public.invoice_number_series s
      where s.fiscal_year = _fiscal_year and s.enabled
        and lower(trim(s.state_name)) = lower(trim(coalesce(_state_name, '')))
      limit 1),
    (select s.state_code from public.invoice_number_series s
      where s.fiscal_year = _fiscal_year and s.enabled and s.state_code = 'MH'
      limit 1)
  )
$$;

grant execute on function public.resolve_invoice_series_state(text, text) to authenticated, service_role;

-- Finalise one invoice for one or more units: consumes the next number for the
-- billing state on the given date and records what it was used against.
create or replace function public.generate_final_invoice(
  _unit_ids uuid[],
  _period_start date,
  _period_end date,
  _invoice_date date default current_date,
  _billing_state text default null,
  _client_token text default null,
  _customer_id uuid default null,
  _party_name text default null,
  _taxable_value numeric default 0,
  _tax_total numeric default 0,
  _total_value numeric default 0
) returns table (invoice_no text, sequence integer, fiscal_year text, month_code text, state_code text, final_invoice_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  s public.invoice_number_series;
  fy text; mc text; sc text; nxt integer; num text; tok text;
  reg_id uuid; fin_id uuid; existing text; uid uuid;
begin
  if _unit_ids is null or array_length(_unit_ids, 1) is null then
    raise exception 'Select at least one site to finalise';
  end if;
  if not (select public.current_user_has_permission('invoicing', null, 'edit')) then
    raise exception 'Not permitted to generate final invoices';
  end if;

  select fi.invoice_no into existing
    from public.final_invoice_units fu
    join public.final_invoices fi on fi.id = fu.final_invoice_id
    where fu.unit_id = any(_unit_ids)
      and fu.period_start = _period_start and fu.period_end = _period_end
    limit 1;
  if existing is not null then
    raise exception 'A final invoice (%) already exists for this period', existing;
  end if;

  fy := public.invoice_fiscal_year(_invoice_date);
  mc := public.invoice_month_code(_invoice_date);
  sc := public.resolve_invoice_series_state(_billing_state, fy);
  tok := nullif(upper(trim(coalesce(_client_token, ''))), '');

  select ns.* into s from public.invoice_number_series ns
    where ns.state_code = sc and ns.fiscal_year = fy and ns.enabled
    for update;
  if not found then
    raise exception 'No enabled invoice number series for % in FY %', sc, fy;
  end if;

  nxt := s.last_sequence + 1;
  num := public.build_invoice_number(s.number_prefix, mc, fy, tok, nxt, s.seq_padding);
  update public.invoice_number_series set last_sequence = nxt where id = s.id;

  insert into public.invoice_number_registry
    (state_code, fiscal_year, month_code, sequence, client_token, invoice_no, party_name, source, unit_id, issued_on, created_by)
  values (sc, fy, mc, nxt, tok, num, _party_name, 'system', _unit_ids[1], _invoice_date, auth.uid())
  returning id into reg_id;

  insert into public.final_invoices
    (invoice_no, state_code, fiscal_year, month_code, sequence, client_token, customer_id, party_name,
     billing_state, invoice_date, period_start, period_end, taxable_value, tax_total, total_value, registry_id, generated_by)
  values (num, sc, fy, mc, nxt, tok, _customer_id, _party_name, _billing_state, _invoice_date,
     _period_start, _period_end, coalesce(_taxable_value, 0), coalesce(_tax_total, 0), coalesce(_total_value, 0), reg_id, auth.uid())
  returning id into fin_id;

  foreach uid in array _unit_ids loop
    insert into public.final_invoice_units (final_invoice_id, unit_id, period_start, period_end)
    values (fin_id, uid, _period_start, _period_end);
  end loop;

  return query select num, nxt, fy, mc, sc, fin_id;
end $$;

revoke all on function public.generate_final_invoice(uuid[], date, date, date, text, text, uuid, text, numeric, numeric, numeric) from public;
grant execute on function public.generate_final_invoice(uuid[], date, date, date, text, text, uuid, text, numeric, numeric, numeric) to authenticated, service_role;

commit;
