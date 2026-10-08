-- Case Desk: legal case register with configurable case types, documents and timeline.
-- Access follows Access Control module `legal_cases` (view / edit / delete).
begin;

create table if not exists public.legal_case_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.legal_case_seq start 1001;

create table if not exists public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('CASE-' || nextval('public.legal_case_seq')),
  title text not null,
  case_type_id uuid references public.legal_case_types(id) on delete set null,
  status text not null default 'open' check (status in ('open','in_progress','on_hold','closed')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  description text not null default '',
  employee_id uuid references public.candidates(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  opposing_party text,
  court_or_authority text,
  reference_no text,
  filed_on date,
  next_hearing_on date,
  amount_involved numeric(14,2),
  owner_id uuid references public.candidates(id) on delete set null,
  outcome text,
  closed_at timestamptz,
  created_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists legal_cases_status_idx on public.legal_cases(status);

create table if not exists public.legal_case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete cascade,
  path text not null,
  file_name text not null,
  uploaded_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now()
);

create table if not exists public.legal_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete cascade,
  kind text not null default 'note',
  note text not null,
  author_id uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.legal_case_types, public.legal_cases, public.legal_case_documents, public.legal_case_notes to authenticated;
grant all on public.legal_case_types, public.legal_cases, public.legal_case_documents, public.legal_case_notes to service_role;
grant usage on sequence public.legal_case_seq to authenticated, service_role;

alter table public.legal_case_types enable row level security;
alter table public.legal_cases enable row level security;
alter table public.legal_case_documents enable row level security;
alter table public.legal_case_notes enable row level security;

create policy "case types read" on public.legal_case_types for select to authenticated using (true);
create policy "case types write" on public.legal_case_types for all to authenticated
  using ((select public.current_user_module_access('legal_cases','edit')) or (select public.current_user_module_access('control_center','edit')))
  with check ((select public.current_user_module_access('legal_cases','edit')) or (select public.current_user_module_access('control_center','edit')));

do $$ declare t text; begin
  foreach t in array array['legal_cases','legal_case_documents','legal_case_notes'] loop
    execute format('create policy "%1$s view" on public.%1$s for select to authenticated using ((select public.current_user_module_access(''legal_cases'',''view'')))', t);
    execute format('create policy "%1$s insert" on public.%1$s for insert to authenticated with check ((select public.current_user_module_access(''legal_cases'',''edit'')))', t);
    execute format('create policy "%1$s update" on public.%1$s for update to authenticated using ((select public.current_user_module_access(''legal_cases'',''edit''))) with check ((select public.current_user_module_access(''legal_cases'',''edit'')))', t);
    execute format('create policy "%1$s delete" on public.%1$s for delete to authenticated using ((select public.current_user_module_access(''legal_cases'',''delete'')))', t);
  end loop;
end $$;

create trigger legal_case_types_updated before update on public.legal_case_types for each row execute function public.set_updated_at();
create trigger legal_cases_updated before update on public.legal_cases for each row execute function public.set_updated_at();
create trigger zz_audit after insert or update or delete on public.legal_case_types for each row execute function public.audit_row_change('Case Types');
create trigger zz_audit after insert or update or delete on public.legal_cases for each row execute function public.audit_row_change('Case Desk');
create trigger zz_audit after insert or update or delete on public.legal_case_documents for each row execute function public.audit_row_change('Case Desk');

insert into storage.buckets (id, name, public) values ('legal-docs','legal-docs', false) on conflict (id) do nothing;
create policy "legal docs read" on storage.objects for select to authenticated
  using (bucket_id = 'legal-docs' and (select public.current_user_module_access('legal_cases','view')));
create policy "legal docs write" on storage.objects for insert to authenticated
  with check (bucket_id = 'legal-docs' and (select public.current_user_module_access('legal_cases','edit')));
create policy "legal docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'legal-docs' and (select public.current_user_module_access('legal_cases','delete')));

insert into public.legal_case_types (name, description, sort_order) values
  ('Labour / Industrial dispute', 'Labour court, conciliation, union matters', 10),
  ('Employee misconduct / disciplinary', 'Theft, absence, negligence on duty, inquiry', 20),
  ('Wage / gratuity / bonus claim', 'Claims under wage, gratuity or bonus laws', 30),
  ('PF / ESIC compliance', 'EPFO / ESIC notices, inspections, damages', 40),
  ('Licensing (PSARA / CLRA / Shops)', 'Agency licence, contract labour registration', 50),
  ('Client contract dispute', 'Billing disputes, termination, recovery', 60),
  ('Penalty / deduction by client', 'Client-imposed penalties and recoveries', 70),
  ('Theft / loss / damage at site', 'Incident at client premises, insurance claims', 80),
  ('Accident / injury / compensation', 'Workmen compensation, ESIC injury', 90),
  ('Police / FIR / criminal', 'FIRs, police complaints, criminal proceedings', 100),
  ('Harassment / POSH', 'Internal committee complaints', 110),
  ('Tax / GST notice', 'GST, income tax, professional tax notices', 120),
  ('Vendor / supplier dispute', 'Uniform, vehicle and other vendor disputes', 130),
  ('Consumer / civil suit', 'Civil suits and consumer complaints', 140),
  ('Other', 'Anything else', 999)
on conflict (name) do nothing;

commit;
