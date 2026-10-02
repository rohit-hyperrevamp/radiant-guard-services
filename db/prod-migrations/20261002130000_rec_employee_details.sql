-- Recruiter captures all employee master details; HR Head only sets salary.
alter table public.rec_candidates add column if not exists employee_details jsonb not null default '{}'::jsonb;

create or replace function public.rec_send_to_hr_head(_candidate_id uuid, _offer jsonb)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare c record; _req uuid; d jsonb; _missing text[] := '{}'; k text;
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
  d := coalesce(c.employee_details, '{}'::jsonb);
  foreach k in array array['date_of_birth','gender','aadhaar_number','pan_number','permanent_address1','permanent_city','permanent_state','permanent_pincode','bank_account_number','bank_ifsc','emergency_contact_name','emergency_contact_mobile'] loop
    if coalesce(trim(d->>k), '') = '' then _missing := _missing || k; end if;
  end loop;
  if array_length(_missing, 1) > 0 then
    raise exception 'Complete the employee details first (missing: %)', array_to_string(_missing, ', ');
  end if;

  update public.rec_candidates set offer = _offer, stage = 'pending_onboarding' where id = c.id;
  select id into _req from public.rec_onboarding_requests where candidate_id = c.id and status = 'pending' limit 1;
  if _req is null then
    insert into public.rec_onboarding_requests(candidate_id, offer, requested_by) values (c.id, _offer, auth.uid()) returning id into _req;
  else
    update public.rec_onboarding_requests set offer = _offer where id = _req;
  end if;
  insert into public.rec_events(candidate_id, event, details)
  values (c.id, 'sent_to_hr_head', 'Offer ₹' || (_offer->>'monthly_ctc') || ' / month, joining ' || (_offer->>'joining_date'));
  return _req;
end; $function$;

create or replace function public.rec_onboard_candidate(_request_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare r record; c record; o jsonb; d jsonb; _new uuid; _code text; _doj date; _live boolean;
begin
  if not public.current_user_can_onboard_recruit() then raise exception 'Not allowed'; end if;
  select * into r from public.rec_onboarding_requests where id = _request_id for update;
  if not found or r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  select * into c from public.rec_candidates where id = r.candidate_id for update;
  o := r.offer; d := coalesce(c.employee_details, '{}'::jsonb);
  if coalesce(c.mobile, '') <> '' and exists (select 1 from public.candidates where mobile = c.mobile) then
    raise exception 'An employee with mobile % already exists', c.mobile;
  end if;
  if coalesce(d->>'aadhaar_number','') <> '' and exists (select 1 from public.candidates where aadhaar_number = d->>'aadhaar_number') then
    raise exception 'An employee with this Aadhaar already exists';
  end if;
  _doj := nullif(o->>'joining_date','')::date;
  _live := _doj is null or _doj <= (now() at time zone 'Asia/Kolkata')::date;
  insert into public.candidates(full_name, mobile, email, designation_id, department_id, unit_id, reports_to,
      preferred_joining_date, non_billable, status, role_key, is_enabled, onboarding_details,
      date_of_birth, gender, marital_status, religion, caste_category, alt_mobile,
      aadhaar_number, pan_number,
      permanent_address1, permanent_address2, permanent_landmark, permanent_city, permanent_district, permanent_state, permanent_pincode, permanent_country,
      same_as_permanent, present_address1, present_address2, present_landmark, present_city, present_district, present_state, present_pincode, present_country,
      bank_account_holder, bank_account_number, bank_ifsc, bank_name, bank_branch, bank_account_type,
      emergency_contact_name, emergency_contact_relation, emergency_contact_mobile,
      compliance, physical_health, other_info)
  values (c.full_name, c.mobile, c.email,
      nullif(o->>'designation_id','')::uuid, nullif(o->>'department_id','')::uuid,
      coalesce(nullif(o->>'unit_id','')::uuid, '92541381-14d3-4be6-ae8c-078b79c2e0f1'::uuid),
      nullif(o->>'reports_to','')::uuid, _doj,
      true, 'approved', coalesce(o->>'role_key',''), _live,
      jsonb_build_object('recruitment', jsonb_build_object('rec_candidate_id', c.id, 'code', c.code, 'offer', o,
        'activation', case when _live then 'done' else 'scheduled' end)),
      nullif(d->>'date_of_birth','')::date, nullif(d->>'gender',''), nullif(d->>'marital_status',''), nullif(d->>'religion',''), nullif(d->>'caste_category',''), nullif(d->>'alt_mobile',''),
      nullif(d->>'aadhaar_number',''), upper(nullif(d->>'pan_number','')),
      nullif(d->>'permanent_address1',''), nullif(d->>'permanent_address2',''), nullif(d->>'permanent_landmark',''), nullif(d->>'permanent_city',''), nullif(d->>'permanent_district',''), nullif(d->>'permanent_state',''), nullif(d->>'permanent_pincode',''), coalesce(nullif(d->>'permanent_country',''), 'India'),
      coalesce((d->>'same_as_permanent')::boolean, true),
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_address1','') else nullif(d->>'present_address1','') end,
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_address2','') else nullif(d->>'present_address2','') end,
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_landmark','') else nullif(d->>'present_landmark','') end,
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_city','') else nullif(d->>'present_city','') end,
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_district','') else nullif(d->>'present_district','') end,
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_state','') else nullif(d->>'present_state','') end,
      case when coalesce((d->>'same_as_permanent')::boolean, true) then nullif(d->>'permanent_pincode','') else nullif(d->>'present_pincode','') end,
      'India',
      coalesce(nullif(d->>'bank_account_holder',''), c.full_name), nullif(d->>'bank_account_number',''), upper(nullif(d->>'bank_ifsc','')), nullif(d->>'bank_name',''), nullif(d->>'bank_branch',''), coalesce(nullif(d->>'bank_account_type',''), 'Savings'),
      nullif(d->>'emergency_contact_name',''), nullif(d->>'emergency_contact_relation',''), nullif(d->>'emergency_contact_mobile',''),
      jsonb_strip_nulls(jsonb_build_object('uan', nullif(d->>'uan',''), 'esic_number', nullif(d->>'esic_number',''))),
      jsonb_strip_nulls(jsonb_build_object('blood_group', nullif(d->>'blood_group',''))),
      jsonb_strip_nulls(jsonb_build_object('father_name', nullif(d->>'father_name',''), 'mother_name', nullif(d->>'mother_name',''), 'spouse_name', nullif(d->>'spouse_name',''))))
  returning id, employee_code into _new, _code;
  update public.rec_onboarding_requests set status = 'onboarded', decided_by = auth.uid(), decided_at = now(), employee_candidate_id = _new where id = r.id;
  update public.rec_candidates set stage = 'onboarded', employee_candidate_id = _new, onboarded_at = now() where id = c.id;
  insert into public.rec_events(candidate_id, event, details)
  values (c.id, 'onboarded', 'Employee ID ' || _code || case when _live then ' · live now' else ' · goes live on ' || to_char(_doj, 'DD Mon YYYY') end);
  return _code;
end; $function$;
