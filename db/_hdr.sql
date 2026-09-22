-- Invoice numbering register: per-state fiscal-year series, client alpha tokens,
-- the full issued-number register, and atomic allocation of the next number.
begin;

create table if not exists public.invoice_number_series (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  state_name text not null,
  number_prefix text,
  fiscal_year text not null,
  last_sequence integer not null default 0,
  seq_padding integer not null default 4,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, fiscal_year)
);

create table if not exists public.invoice_number_client_tokens (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  token text not null,
  sample_party_name text,
  customer_id uuid references public.customers(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, token)
);

create table if not exists public.invoice_number_registry (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  fiscal_year text not null,
  month_code text not null,
  sequence integer not null,
  client_token text,
  invoice_no text not null,
  party_name text,
  irn_number text,
  remarks text,
  irn_date_text text,
  source text not null default 'system' check (source in ('import', 'system', 'manual')),
  unit_id uuid references public.units(id) on delete set null,
  issued_on date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, fiscal_year, invoice_no)
);

create index if not exists invoice_number_registry_state_fy_idx
  on public.invoice_number_registry(state_code, fiscal_year, sequence desc);
create index if not exists invoice_number_registry_month_idx
  on public.invoice_number_registry(state_code, fiscal_year, month_code);
create index if not exists invoice_number_registry_party_idx
  on public.invoice_number_registry(lower(party_name));

grant select, insert, update, delete on public.invoice_number_series to authenticated;
grant select, insert, update, delete on public.invoice_number_client_tokens to authenticated;
grant select, insert, update, delete on public.invoice_number_registry to authenticated;
grant all on public.invoice_number_series to service_role;
grant all on public.invoice_number_client_tokens to service_role;
grant all on public.invoice_number_registry to service_role;

alter table public.invoice_number_series enable row level security;
alter table public.invoice_number_client_tokens enable row level security;
alter table public.invoice_number_registry enable row level security;

do $$
declare t text;
begin
  foreach t in array array['invoice_number_series','invoice_number_client_tokens','invoice_number_registry'] loop
    execute format('drop policy if exists "invno read" on public.%I', t);
    execute format('create policy "invno read" on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists "invno insert" on public.%I', t);
    execute format($f$create policy "invno insert" on public.%I for insert to authenticated
      with check ((select public.current_user_has_permission('control_center','invoice_numbering','edit')))$f$, t);
    execute format('drop policy if exists "invno update" on public.%I', t);
    execute format($f$create policy "invno update" on public.%I for update to authenticated
      using ((select public.current_user_has_permission('control_center','invoice_numbering','edit')))
      with check ((select public.current_user_has_permission('control_center','invoice_numbering','edit')))$f$, t);
    execute format('drop policy if exists "invno delete" on public.%I', t);
    execute format($f$create policy "invno delete" on public.%I for delete to authenticated
      using ((select public.current_user_has_permission('control_center','invoice_numbering','delete')))$f$, t);
  end loop;
end $$;

drop trigger if exists invoice_number_series_set_updated_at on public.invoice_number_series;
create trigger invoice_number_series_set_updated_at before update on public.invoice_number_series
  for each row execute function public.set_updated_at();
drop trigger if exists invoice_number_client_tokens_set_updated_at on public.invoice_number_client_tokens;
create trigger invoice_number_client_tokens_set_updated_at before update on public.invoice_number_client_tokens
  for each row execute function public.set_updated_at();
drop trigger if exists invoice_number_registry_set_updated_at on public.invoice_number_registry;
create trigger invoice_number_registry_set_updated_at before update on public.invoice_number_registry
  for each row execute function public.set_updated_at();

-- Fiscal year label for a date: April 2026 .. March 2027 => '26-27'.
create or replace function public.invoice_fiscal_year(_on date)
returns text language sql immutable as $$
  select case when extract(month from _on) >= 4
    then to_char(_on, 'YY') || '-' || to_char(_on + interval '1 year', 'YY')
    else to_char(_on - interval '1 year', 'YY') || '-' || to_char(_on, 'YY')
  end
$$;

create or replace function public.invoice_month_code(_on date)
returns text language sql immutable as $$
  select upper(to_char(_on, 'MON'))
$$;

create or replace function public.build_invoice_number(
  _prefix text, _month_code text, _fiscal_year text, _token text, _sequence integer, _padding integer
) returns text language sql immutable as $$
  select coalesce(nullif(trim(_prefix), '') || '-', '')
      || _month_code || _fiscal_year || '-'
      || coalesce(nullif(upper(trim(_token)), ''), '')
      || lpad(_sequence::text, greatest(coalesce(_padding, 4), 1), '0')
$$;

-- Preview the next number without consuming it.
create or replace function public.peek_invoice_number(
  _state_code text, _invoice_date date default current_date, _client_token text default null
) returns table (invoice_no text, next_sequence integer, fiscal_year text, month_code text)
language plpgsql stable security definer set search_path = public as $$
declare s public.invoice_number_series; fy text; mc text;
begin
  fy := public.invoice_fiscal_year(_invoice_date);
  mc := public.invoice_month_code(_invoice_date);
  select * into s from public.invoice_number_series
    where state_code = upper(_state_code) and fiscal_year = fy and enabled;
  if not found then
    raise exception 'No enabled invoice number series for % in FY %', upper(_state_code), fy;
  end if;
  return query select public.build_invoice_number(s.number_prefix, mc, fy, _client_token, s.last_sequence + 1, s.seq_padding),
    s.last_sequence + 1, fy, mc;
end $$;

-- Consume the next number for a state, log it in the register, and return it.
create or replace function public.allocate_invoice_number(
  _state_code text,
  _invoice_date date default current_date,
  _party_name text default null,
  _client_token text default null,
  _unit_id uuid default null
) returns table (invoice_no text, sequence integer, fiscal_year text, month_code text)
language plpgsql security definer set search_path = public as $$
declare s public.invoice_number_series; fy text; mc text; nxt integer; num text;
begin
  if not (select public.current_user_has_permission('invoicing', null, 'edit'))
     and not (select public.current_user_has_permission('control_center','invoice_numbering','edit')) then
    raise exception 'Not permitted to allocate invoice numbers';
  end if;
  fy := public.invoice_fiscal_year(_invoice_date);
  mc := public.invoice_month_code(_invoice_date);
  select * into s from public.invoice_number_series
    where state_code = upper(_state_code) and fiscal_year = fy and enabled
    for update;
  if not found then
    raise exception 'No enabled invoice number series for % in FY %', upper(_state_code), fy;
  end if;
  nxt := s.last_sequence + 1;
  num := public.build_invoice_number(s.number_prefix, mc, fy, _client_token, nxt, s.seq_padding);
  update public.invoice_number_series set last_sequence = nxt where id = s.id;
  insert into public.invoice_number_registry
    (state_code, fiscal_year, month_code, sequence, client_token, invoice_no, party_name, source, unit_id, issued_on, created_by)
  values (s.state_code, fy, mc, nxt, nullif(upper(trim(coalesce(_client_token, ''))), ''), num, _party_name, 'system', _unit_id, _invoice_date, auth.uid());
  return query select num, nxt, fy, mc;
end $$;

revoke all on function public.allocate_invoice_number(text, date, text, text, uuid) from public;
grant execute on function public.allocate_invoice_number(text, date, text, text, uuid) to authenticated, service_role;
grant execute on function public.peek_invoice_number(text, date, text) to authenticated, service_role;
grant execute on function public.invoice_fiscal_year(date) to authenticated, service_role;
grant execute on function public.invoice_month_code(date) to authenticated, service_role;
grant execute on function public.build_invoice_number(text, text, text, text, integer, integer) to authenticated, service_role;

create or replace view public.invoice_number_month_counts as
  select state_code, fiscal_year, month_code,
    case month_code when 'APR' then 1 when 'MAY' then 2 when 'JUN' then 3 when 'JUL' then 4
      when 'AUG' then 5 when 'SEP' then 6 when 'OCT' then 7 when 'NOV' then 8 when 'DEC' then 9
      when 'JAN' then 10 when 'FEB' then 11 when 'MAR' then 12 else 99 end as month_order,
    count(*)::int as invoice_count,
    min(sequence)::int as first_sequence,
    max(sequence)::int as last_sequence
  from public.invoice_number_registry
  group by state_code, fiscal_year, month_code;

grant select on public.invoice_number_month_counts to authenticated, service_role;
