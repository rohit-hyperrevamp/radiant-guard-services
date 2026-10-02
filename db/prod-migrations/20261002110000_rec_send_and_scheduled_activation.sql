-- Recruitment: atomic "Send to HR Head", and new hires go live on their joining date.

create or replace function public.rec_send_to_hr_head(_candidate_id uuid, _offer jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare c record; _req uuid;
begin
  if not public.current_user_can_recruit() then raise exception 'You do not have Recruitment access'; end if;
  select * into c from public.rec_candidates where id = _candidate_id for update;
  if not found then raise exception 'Candidate not found'; end if;
  if c.stage not in ('hr_approved', 'pending_onboarding') then
    raise exception 'Candidate must clear all rounds before the offer is sent (current stage: %)', c.stage;
  end if;
  if coalesce((_offer->>'monthly_ctc')::numeric, 0) <= 0 then raise exception 'Enter the offered monthly CTC'; end if;
  if coalesce(_offer->>'joining_date', '') = '' then raise exception 'Enter the date of joining'; end if;
  if coalesce(_offer->>'designation_id', '') = '' or coalesce(_offer->>'department_id', '') = '' then
    raise exception 'Pick designation and department';
  end if;

  update public.rec_candidates set offer = _offer, stage = 'pending_onboarding' where id = c.id;

  select id into _req from public.rec_onboarding_requests where candidate_id = c.id and status = 'pending' limit 1;
  if _req is null then
    insert into public.rec_onboarding_requests(candidate_id, offer, requested_by)
    values (c.id, _offer, auth.uid()) returning id into _req;
  else
    update public.rec_onboarding_requests set offer = _offer where id = _req;
  end if;

  insert into public.rec_events(candidate_id, event, details)
  values (c.id, 'sent_to_hr_head', 'Offer ₹' || (_offer->>'monthly_ctc') || ' / month, joining ' || (_offer->>'joining_date'));
  return _req;
end; $$;

revoke all on function public.rec_send_to_hr_head(uuid, jsonb) from public, anon;
grant execute on function public.rec_send_to_hr_head(uuid, jsonb) to authenticated;

-- Onboarding: employee ID issued now; sign-in enabled on the joining date.
create or replace function public.rec_onboard_candidate(_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare r record; c record; o jsonb; _new uuid; _code text; _doj date; _live boolean;
begin
  if not public.current_user_can_onboard_recruit() then raise exception 'Not allowed'; end if;
  select * into r from public.rec_onboarding_requests where id = _request_id for update;
  if not found or r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  select * into c from public.rec_candidates where id = r.candidate_id for update;
  o := r.offer;
  if coalesce(c.mobile, '') <> '' and exists (select 1 from public.candidates where mobile = c.mobile) then
    raise exception 'An employee with mobile % already exists', c.mobile;
  end if;
  _doj := nullif(o->>'joining_date','')::date;
  _live := _doj is null or _doj <= (now() at time zone 'Asia/Kolkata')::date;
  insert into public.candidates(full_name, mobile, email, designation_id, department_id, unit_id, reports_to,
      preferred_joining_date, non_billable, status, role_key, is_enabled, onboarding_details)
  values (c.full_name, c.mobile, c.email,
      nullif(o->>'designation_id','')::uuid, nullif(o->>'department_id','')::uuid,
      coalesce(nullif(o->>'unit_id','')::uuid, '92541381-14d3-4be6-ae8c-078b79c2e0f1'::uuid),
      nullif(o->>'reports_to','')::uuid, _doj,
      true, 'approved', coalesce(o->>'role_key',''), _live,
      jsonb_build_object('recruitment', jsonb_build_object('rec_candidate_id', c.id, 'code', c.code, 'offer', o,
        'activation', case when _live then 'done' else 'scheduled' end)))
  returning id, employee_code into _new, _code;
  update public.rec_onboarding_requests set status = 'onboarded', decided_by = auth.uid(), decided_at = now(), employee_candidate_id = _new where id = r.id;
  update public.rec_candidates set stage = 'onboarded', employee_candidate_id = _new, onboarded_at = now() where id = c.id;
  insert into public.rec_events(candidate_id, event, details)
  values (c.id, 'onboarded', 'Employee ID ' || _code || case when _live then ' · live now' else ' · goes live on ' || to_char(_doj, 'DD Mon YYYY') end);
  return _code;
end; $function$;

-- Daily activation of recruits whose joining date has arrived.
create or replace function public.rec_activate_joiners()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.candidates
     set is_enabled = true,
         onboarding_details = jsonb_set(onboarding_details, '{recruitment,activation}', '"done"')
   where onboarding_details->'recruitment'->>'activation' = 'scheduled'
     and status in ('approved','active')
     and preferred_joining_date <= (now() at time zone 'Asia/Kolkata')::date;
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.rec_activate_joiners() from public, anon, authenticated;

select cron.unschedule('rec-activate-joiners') where exists (select 1 from cron.job where jobname = 'rec-activate-joiners');
select cron.schedule('rec-activate-joiners', '5 18 * * *', $$select public.rec_activate_joiners();$$);
