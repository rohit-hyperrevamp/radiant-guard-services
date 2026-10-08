-- Case Desk: named documents, next hearing time, upcoming-hearing alerts to the feed.
alter table public.legal_case_documents add column if not exists title text;
alter table public.legal_cases add column if not exists next_hearing_time time;
create index if not exists legal_cases_next_hearing_idx on public.legal_cases(next_hearing_on) where status <> 'closed';

-- Recipients: Access Control sub-module legal_cases::hearing_alerts decides; no row = anyone who can view Case Desk.
create or replace function public.candidate_gets_case_hearing_alerts(_candidate_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.can_view from public.effective_permissions_for(_candidate_id) p
      where p.module_key = 'legal_cases' and p.sub_module_key = 'hearing_alerts' limit 1),
    exists (select 1 from public.effective_permissions_for(_candidate_id) p
      where p.module_key = 'legal_cases' and p.can_view)
    or (select role_key from public.candidates where id = _candidate_id) in ('admin','super_admin'));
$$;

create or replace function public.notify_case_hearing(_case_id uuid, _kind text, _title text, _msg text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with people as (
    select au.id as user_id from public.candidates c
      join auth.users au on au.email = 'phone-' || c.mobile || '@radiantguard.local'
     where coalesce(c.status,'') = 'active' and public.candidate_gets_case_hearing_alerts(c.id)
  ), ins as (
    insert into public.notifications (user_id, type, title, message, link, entity_type, entity_id)
    select p.user_id, _kind, _title, _msg, '/admin/cases?view=upcoming&case=' || _case_id::text, 'legal_case', _case_id::text
      from people p
     where not exists (select 1 from public.notifications x where x.user_id = p.user_id and x.entity_id = _case_id::text
                        and x.type = _kind and x.message = _msg and x.created_at > now() - interval '20 hours')
    returning 1)
  select count(*) into n from ins;
  return n;
end $$;

create or replace function public.send_case_hearing_alerts()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; total integer := 0; dl integer;
begin
  for r in select id, case_number, title, next_hearing_on, next_hearing_time, court_or_authority from public.legal_cases
            where status <> 'closed' and next_hearing_on is not null
              and (next_hearing_on - (now() at time zone 'Asia/Kolkata')::date) in (0,1,3,7) loop
    dl := r.next_hearing_on - (now() at time zone 'Asia/Kolkata')::date;
    total := total + public.notify_case_hearing(r.id, 'case_hearing:' || dl,
      case when dl = 0 then 'Case date today' when dl = 1 then 'Case date tomorrow' else 'Case date in ' || dl || ' days' end,
      r.case_number || ' · ' || r.title || ' — ' || to_char(r.next_hearing_on, 'DD Mon YYYY')
        || coalesce(' at ' || to_char(r.next_hearing_time, 'HH12:MI AM'), '') || coalesce(' · ' || r.court_or_authority, ''));
  end loop;
  return total;
end $$;

create or replace function public.trg_case_hearing_set()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.next_hearing_on is not null and new.status <> 'closed'
     and new.next_hearing_on >= (now() at time zone 'Asia/Kolkata')::date
     and (tg_op = 'INSERT' or new.next_hearing_on is distinct from old.next_hearing_on or new.next_hearing_time is distinct from old.next_hearing_time) then
    perform public.notify_case_hearing(new.id, 'case_hearing:set', 'Next case date set',
      new.case_number || ' · ' || new.title || ' — ' || to_char(new.next_hearing_on, 'DD Mon YYYY')
        || coalesce(' at ' || to_char(new.next_hearing_time, 'HH12:MI AM'), ''));
  end if;
  return new;
end $$;
drop trigger if exists case_hearing_set on public.legal_cases;
create trigger case_hearing_set after insert or update of next_hearing_on, next_hearing_time on public.legal_cases
  for each row execute function public.trg_case_hearing_set();

revoke execute on function public.notify_case_hearing(uuid,text,text,text), public.send_case_hearing_alerts() from public, anon, authenticated;

select cron.unschedule('case-hearing-alerts') where exists (select 1 from cron.job where jobname = 'case-hearing-alerts');
select cron.schedule('case-hearing-alerts', '0 3 * * *', 'select public.send_case_hearing_alerts()');
