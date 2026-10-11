-- Case Desk upgrade: court history, India court master, parties, advocates, representative,
-- legal notices, employee summary. Access follows Access Control module `legal_cases`.
begin;

create table if not exists public.legal_courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  court_type text not null default 'Other',
  state text not null default '',
  city text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  unique (name, state, city)
);

create table if not exists public.legal_parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  phone text,
  email text,
  gstin text,
  notes text not null default '',
  created_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists legal_parties_name_uq on public.legal_parties (lower(name));

create table if not exists public.legal_advocates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'retainer' check (kind in ('in_house','retainer')),
  phone text,
  email text,
  firm text,
  bar_council_no text,
  address text,
  engaged_on date,
  is_active boolean not null default true,
  notes text not null default '',
  created_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists legal_advocates_name_uq on public.legal_advocates (lower(name));

alter table public.legal_cases
  add column if not exists party_id uuid references public.legal_parties(id) on delete set null,
  add column if not exists party_name text,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists state text,
  add column if not exists advocate_id uuid references public.legal_advocates(id) on delete set null,
  add column if not exists representative_id uuid references public.candidates(id) on delete set null;

create table if not exists public.legal_case_courts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete cascade,
  court_id uuid references public.legal_courts(id) on delete set null,
  court_name text not null,
  reference_no text,
  state text,
  from_date date,
  note text not null default '',
  is_current boolean not null default true,
  created_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now()
);
create index if not exists legal_case_courts_case_idx on public.legal_case_courts(case_id);

create table if not exists public.legal_case_advocate_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete cascade,
  advocate_id uuid references public.legal_advocates(id) on delete set null,
  advocate_name text not null,
  from_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  to_date date,
  note text not null default '',
  created_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now()
);
create index if not exists legal_case_advocate_log_case_idx on public.legal_case_advocate_log(case_id);

create sequence if not exists public.legal_notice_seq start 101;
create table if not exists public.legal_notices (
  id uuid primary key default gen_random_uuid(),
  notice_number text not null unique default ('LN-' || nextval('public.legal_notice_seq')),
  template text not null default 'general',
  status text not null default 'draft' check (status in ('draft','sent','replied','closed')),
  case_id uuid references public.legal_cases(id) on delete set null,
  party_id uuid references public.legal_parties(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  employee_id uuid references public.candidates(id) on delete set null,
  advocate_id uuid references public.legal_advocates(id) on delete set null,
  notice_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  mode text not null default 'RPAD',
  to_name text not null default '',
  to_address text not null default '',
  from_name text not null default '',
  from_address text not null default '',
  subject text not null default '',
  body text not null default '',
  demand_amount numeric(14,2),
  deadline_days int default 15,
  sent_on date,
  created_by uuid default public.current_user_candidate_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.legal_courts, public.legal_parties, public.legal_advocates,
  public.legal_case_courts, public.legal_case_advocate_log, public.legal_notices to authenticated;
grant all on public.legal_courts, public.legal_parties, public.legal_advocates,
  public.legal_case_courts, public.legal_case_advocate_log, public.legal_notices to service_role;
grant usage on sequence public.legal_notice_seq to authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['legal_courts','legal_parties','legal_advocates','legal_case_courts','legal_case_advocate_log','legal_notices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s view" on public.%1$s for select to authenticated using ((select public.current_user_module_access(''legal_cases'',''view'')))', t);
    execute format('create policy "%1$s insert" on public.%1$s for insert to authenticated with check ((select public.current_user_module_access(''legal_cases'',''edit'')))', t);
    execute format('create policy "%1$s update" on public.%1$s for update to authenticated using ((select public.current_user_module_access(''legal_cases'',''edit''))) with check ((select public.current_user_module_access(''legal_cases'',''edit'')))', t);
    execute format('create policy "%1$s delete" on public.%1$s for delete to authenticated using ((select public.current_user_module_access(''legal_cases'',''delete'')))', t);
    execute format('create trigger zz_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change(''Case Desk'')', t);
  end loop;
end $$;
create trigger legal_parties_updated before update on public.legal_parties for each row execute function public.set_updated_at();
create trigger legal_advocates_updated before update on public.legal_advocates for each row execute function public.set_updated_at();
create trigger legal_notices_updated before update on public.legal_notices for each row execute function public.set_updated_at();

-- Backfill existing court/reference into the court history.
insert into public.legal_case_courts (case_id, court_name, reference_no, from_date, note, is_current)
select id, court_or_authority, reference_no, filed_on, 'Original filing', true
  from public.legal_cases c
 where coalesce(court_or_authority,'') <> ''
   and not exists (select 1 from public.legal_case_courts x where x.case_id = c.id);

-- Court master: national, every High Court, per-state forums, Pune in detail.
insert into public.legal_courts (name, court_type, state, city, sort_order) values
  ('Supreme Court of India','Supreme Court','','New Delhi',1),
  ('National Consumer Disputes Redressal Commission','Consumer Commission','','New Delhi',5),
  ('National Company Law Appellate Tribunal (NCLAT)','Tribunal','','New Delhi',6),
  ('National Green Tribunal','Tribunal','','New Delhi',7),
  ('Central Administrative Tribunal','Tribunal','','New Delhi',8),
  ('Income Tax Appellate Tribunal (ITAT)','Tax Tribunal','','',9),
  ('GST Appellate Tribunal','Tax Tribunal','','',9),
  ('Customs, Excise & Service Tax Appellate Tribunal (CESTAT)','Tax Tribunal','','',9),
  ('Debts Recovery Appellate Tribunal (DRAT)','Tribunal','','',9),
  ('Bombay High Court','High Court','Maharashtra','Mumbai',10),
  ('Bombay High Court – Nagpur Bench','High Court','Maharashtra','Nagpur',10),
  ('Bombay High Court – Aurangabad Bench','High Court','Maharashtra','Chhatrapati Sambhajinagar',10),
  ('Bombay High Court – Kolhapur Circuit Bench','High Court','Maharashtra','Kolhapur',10),
  ('High Court of Bombay at Goa','High Court','Goa','Panaji',10),
  ('Delhi High Court','High Court','Delhi','New Delhi',10),
  ('Karnataka High Court','High Court','Karnataka','Bengaluru',10),
  ('Karnataka High Court – Dharwad Bench','High Court','Karnataka','Dharwad',10),
  ('Karnataka High Court – Kalaburagi Bench','High Court','Karnataka','Kalaburagi',10),
  ('Madras High Court','High Court','Tamil Nadu','Chennai',10),
  ('Madras High Court – Madurai Bench','High Court','Tamil Nadu','Madurai',10),
  ('Telangana High Court','High Court','Telangana','Hyderabad',10),
  ('Andhra Pradesh High Court','High Court','Andhra Pradesh','Amaravati',10),
  ('Kerala High Court','High Court','Kerala','Kochi',10),
  ('Gujarat High Court','High Court','Gujarat','Ahmedabad',10),
  ('Rajasthan High Court','High Court','Rajasthan','Jodhpur',10),
  ('Rajasthan High Court – Jaipur Bench','High Court','Rajasthan','Jaipur',10),
  ('Madhya Pradesh High Court','High Court','Madhya Pradesh','Jabalpur',10),
  ('Madhya Pradesh High Court – Indore Bench','High Court','Madhya Pradesh','Indore',10),
  ('Madhya Pradesh High Court – Gwalior Bench','High Court','Madhya Pradesh','Gwalior',10),
  ('Allahabad High Court','High Court','Uttar Pradesh','Prayagraj',10),
  ('Allahabad High Court – Lucknow Bench','High Court','Uttar Pradesh','Lucknow',10),
  ('Punjab & Haryana High Court','High Court','Punjab','Chandigarh',10),
  ('Calcutta High Court','High Court','West Bengal','Kolkata',10),
  ('Orissa High Court','High Court','Odisha','Cuttack',10),
  ('Patna High Court','High Court','Bihar','Patna',10),
  ('Jharkhand High Court','High Court','Jharkhand','Ranchi',10),
  ('Chhattisgarh High Court','High Court','Chhattisgarh','Bilaspur',10),
  ('Uttarakhand High Court','High Court','Uttarakhand','Nainital',10),
  ('Himachal Pradesh High Court','High Court','Himachal Pradesh','Shimla',10),
  ('High Court of Jammu & Kashmir and Ladakh','High Court','Jammu and Kashmir','Srinagar',10),
  ('Gauhati High Court','High Court','Assam','Guwahati',10),
  ('Sikkim High Court','High Court','Sikkim','Gangtok',10),
  ('Tripura High Court','High Court','Tripura','Agartala',10),
  ('Manipur High Court','High Court','Manipur','Imphal',10),
  ('Meghalaya High Court','High Court','Meghalaya','Shillong',10),
  -- Pune in detail
  ('District & Sessions Court, Shivajinagar','District Court','Maharashtra','Pune',20),
  ('Civil Court (Senior Division), Shivajinagar','Civil Court','Maharashtra','Pune',21),
  ('Civil Court (Junior Division), Shivajinagar','Civil Court','Maharashtra','Pune',22),
  ('Chief Judicial Magistrate Court, Shivajinagar','Magistrate Court','Maharashtra','Pune',23),
  ('JMFC Court, Shivajinagar','Magistrate Court','Maharashtra','Pune',24),
  ('JMFC Court, Pimpri','Magistrate Court','Maharashtra','Pimpri-Chinchwad',24),
  ('Civil & Criminal Court, Pimpri (Morwadi)','District Court','Maharashtra','Pimpri-Chinchwad',24),
  ('Family Court, Pune','Family Court','Maharashtra','Pune',25),
  ('Labour Court, Pune','Labour Court','Maharashtra','Pune',26),
  ('Industrial Court, Pune','Industrial Court','Maharashtra','Pune',27),
  ('Small Causes Court, Pune','Civil Court','Maharashtra','Pune',28),
  ('Co-operative Court, Pune','Tribunal','Maharashtra','Pune',29),
  ('Motor Accident Claims Tribunal, Pune','MACT','Maharashtra','Pune',30),
  ('District Consumer Disputes Redressal Commission, Pune','Consumer Commission','Maharashtra','Pune',31),
  ('Debts Recovery Tribunal, Pune','DRT','Maharashtra','Pune',32),
  ('Regional PF Commissioner (EPFO), Pune','PF / ESIC Authority','Maharashtra','Pune',33),
  ('ESIC Regional Office, Pune','PF / ESIC Authority','Maharashtra','Pune',34),
  ('Additional Commissioner of Labour, Pune','Labour Authority','Maharashtra','Pune',35),
  ('Commissioner of Police, Pune','Police','Maharashtra','Pune',36),
  ('Commissioner of Police, Pimpri-Chinchwad','Police','Maharashtra','Pimpri-Chinchwad',36),
  ('Sessions Court, Mumbai (City Civil & Sessions)','District Court','Maharashtra','Mumbai',40),
  ('Labour Court, Mumbai','Labour Court','Maharashtra','Mumbai',40),
  ('Industrial Court, Mumbai','Industrial Court','Maharashtra','Mumbai',40),
  ('Central Government Industrial Tribunal (CGIT), Mumbai','Industrial Court','Maharashtra','Mumbai',40),
  ('NCLT, Mumbai Bench','NCLT','Maharashtra','Mumbai',40),
  ('Maharashtra State Consumer Disputes Redressal Commission','Consumer Commission','Maharashtra','Mumbai',40)
on conflict do nothing;

insert into public.legal_courts (name, court_type, state, city, sort_order)
select f.name || ', ' || s.state, f.kind, s.state, '', f.ord
  from (values ('Andhra Pradesh'),('Arunachal Pradesh'),('Assam'),('Bihar'),('Chhattisgarh'),('Goa'),('Gujarat'),('Haryana'),
               ('Himachal Pradesh'),('Jharkhand'),('Karnataka'),('Kerala'),('Madhya Pradesh'),('Maharashtra'),('Manipur'),('Meghalaya'),
               ('Mizoram'),('Nagaland'),('Odisha'),('Punjab'),('Rajasthan'),('Sikkim'),('Tamil Nadu'),('Telangana'),('Tripura'),
               ('Uttar Pradesh'),('Uttarakhand'),('West Bengal'),('Delhi'),('Jammu and Kashmir'),('Chandigarh'),('Puducherry')) s(state)
  cross join (values ('District & Sessions Court','District Court',50),('Civil Court (Senior Division)','Civil Court',51),
                     ('Civil Court (Junior Division)','Civil Court',52),('Chief Judicial Magistrate Court','Magistrate Court',53),
                     ('Judicial Magistrate First Class (JMFC)','Magistrate Court',54),('Family Court','Family Court',55),
                     ('Labour Court','Labour Court',56),('Industrial Tribunal','Industrial Court',57),
                     ('State Consumer Disputes Redressal Commission','Consumer Commission',58),
                     ('District Consumer Disputes Redressal Commission','Consumer Commission',59),
                     ('Motor Accident Claims Tribunal','MACT',60),('Debts Recovery Tribunal','DRT',61),
                     ('NCLT Bench','NCLT',62),('Regional PF Commissioner (EPFO)','PF / ESIC Authority',63),
                     ('ESIC Regional Office','PF / ESIC Authority',64),('Labour Commissioner','Labour Authority',65),
                     ('Police Station / FIR','Police',66),('GST / Tax Authority','Tax Authority',67)) f(name, kind, ord)
on conflict do nothing;

-- Employee summary for Legal (Case Desk view + optional explicit switch).
create or replace function public.legal_employee_summary(_candidate_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not (public.is_admin_user() or (public.current_user_module_access('legal_cases','view')
          and coalesce(public.current_user_explicit_permission('legal_cases','employee_summary','view'), true))) then
    raise exception 'Not allowed';
  end if;
  select jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'employee_code', c.employee_code, 'mobile', c.mobile,
    'email', c.email, 'status', c.status, 'is_enabled', c.is_enabled, 'gender', c.gender, 'date_of_birth', c.date_of_birth,
    'joined_on', coalesce(c.preferred_joining_date, c.approved_at::date), 'approved_at', c.approved_at,
    'offboarded_at', c.offboarded_at, 'offboarding_reason', (select o.name from offboarding_reasons o where o.id = c.offboarding_reason_id),
    'no_hire', c.no_hire, 'designation', (select name from designations where id = c.designation_id),
    'department', (select name from departments where id = c.department_id),
    'address', concat_ws(', ', nullif(c.present_address1,''), nullif(c.present_city,''), nullif(c.present_state,'')),
    'home_unit', (select jsonb_build_object('id', u.id, 'name', u.name, 'code', u.code) from units u where u.id = c.unit_id),
    'units', coalesce((select jsonb_agg(jsonb_build_object('name', u.name, 'code', u.code, 'client', cu2.name,
                 'is_primary', cu.is_primary, 'is_reliever', cu.is_reliever,
                 'designation', (select name from designations where id = cu.designation_id), 'since', cu.created_at::date)
                 order by cu.is_primary desc, cu.created_at)
               from candidate_units cu join units u on u.id = cu.unit_id left join customers cu2 on cu2.id = u.customer_id
              where cu.candidate_id = c.id), '[]'::jsonb),
    'managers', coalesce((select jsonb_agg(jsonb_build_object('name', m.full_name, 'mobile', m.mobile, 'code', m.employee_code,
                 'designation', (select name from designations where id = m.designation_id), 'is_primary', rm.is_primary))
               from candidate_reporting_managers rm join candidates m on m.id = rm.manager_id
              where rm.candidate_id = c.id), '[]'::jsonb),
    'reports_to', (select jsonb_build_object('name', m.full_name, 'mobile', m.mobile) from candidates m where m.id = c.reports_to),
    'payslips', coalesce((select jsonb_agg(x order by x->>'period' desc) from (
                 select jsonb_build_object('period', to_char(coalesce(pr.period_end, s.created_at::date),'YYYY-MM'), 'period_label', to_char(coalesce(pr.period_end, s.created_at::date),'Mon YYYY'), 'unit', u.name,
                   'paid_days', s.paid_days, 'ed_days', s.ed_days, 'gross', s.gross, 'deductions', s.total_deductions,
                   'net_pay', s.net_pay, 'earnings', s.earnings) x
                 from payroll_run_snapshots s left join units u on u.id = s.unit_id
                 left join payroll_runs pr on pr.id = s.payroll_run_id
                where s.candidate_id = c.id order by s.created_at desc limit 12) q), '[]'::jsonb),
    'units_paid_at', (select count(distinct unit_id) from payroll_run_snapshots where candidate_id = c.id),
    'total_paid_days', (select coalesce(sum(paid_days),0) from payroll_run_snapshots where candidate_id = c.id),
    'cases', coalesce((select jsonb_agg(jsonb_build_object('case_number', lc.case_number, 'title', lc.title, 'status', lc.status))
               from legal_cases lc where lc.employee_id = c.id), '[]'::jsonb)
  ) into r from candidates c where c.id = _candidate_id;
  return r;
end $$;
revoke execute on function public.legal_employee_summary(uuid) from public, anon;
grant execute on function public.legal_employee_summary(uuid) to authenticated;

commit;
