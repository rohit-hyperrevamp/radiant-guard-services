-- Missing documents AND missing details in one follow-up list; default view = active people only.
alter table public.employee_document_policies add column if not exists required_details text[] not null default '{}';
update public.employee_document_policies set required_details = case purpose
  when 'offboarding' then array['last_working_date','exit_reason']
  else array['aadhaar_number','bank_account','bank_ifsc','date_of_birth','mobile','present_address'] end
where required_details = '{}';

drop function if exists public.document_followup_list(text,text,boolean,text[],int,int);
drop function if exists public.document_followup_summary();
drop function if exists public.document_followup_pending();

create function public.document_followup_pending()
returns table(id uuid, rec_id uuid, full_name text, code text, purpose text, start_date text, missing text[], missing_details text[], due date, overdue boolean, active boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.current_user_can_recruit() then raise exception 'Not allowed' using errcode='42501'; end if;
  return query
  with pol as (select p.purpose, p.required_keys, p.required_details, p.deadline_days from employee_document_policies p),
  today as (select (now() at time zone 'Asia/Kolkata')::date d),
  emp as (select * from public.document_followup_employees()),
  rec_link as (
    select distinct on (r.employee_candidate_id) r.employee_candidate_id, r.id, r.onboarded_at
    from rec_candidates r where r.employee_candidate_id is not null order by r.employee_candidate_id, r.created_at desc),
  rec_ev as (
    select x.rid, array_agg(x.k) ks from (
      select rc.rec_candidate_id rid, rc.document_key k from employee_document_receipts rc where rc.rec_candidate_id is not null
      union all
      select d.candidate_id, case d.category when '10th_certificate' then 'tenth' when '12th_certificate' then 'twelfth'
        when 'graduation_certificate' then 'graduation' when 'salary_slip' then 'salary_slip' when 'resignation_letter' then 'resignation'
        when 'relieving_letter' then 'relieving' when 'experience_letter' then 'experience' end
      from rec_candidate_documents d where d.file_path is not null and d.file_path<>''
    ) x where x.k is not null group by x.rid),
  emp_ev as (select rc.candidate_id cid, array_agg(rc.document_key) ks from employee_document_receipts rc where rc.candidate_id is not null group by rc.candidate_id),
  emp_det as (
    select c.id cid, array_remove(array[
      case when coalesce(c.aadhaar_number,'')<>'' then 'aadhaar_number' end,
      case when coalesce(c.pan_number,'')<>'' then 'pan_number' end,
      case when coalesce(c.bank_account_number,'')<>'' then 'bank_account' end,
      case when coalesce(c.bank_ifsc,'')<>'' then 'bank_ifsc' end,
      case when coalesce(c.bank_name,'')<>'' then 'bank_name' end,
      case when c.date_of_birth is not null then 'date_of_birth' end,
      case when coalesce(c.mobile,'')<>'' then 'mobile' end,
      case when coalesce(c.present_address1,'')<>'' then 'present_address' end,
      case when coalesce(c.permanent_address1,'')<>'' then 'permanent_address' end,
      case when coalesce(c.emergency_contact_mobile,'')<>'' then 'emergency_contact' end,
      case when coalesce(c.offboarding_details->>'date_of_last_working','')<>'' then 'last_working_date' end,
      case when coalesce(c.offboarding_details->>'reason_text','')<>'' then 'exit_reason' end
    ]::text[], null) ks
    from candidates c where c.id in (select e.id from emp e)),
  rh as (
    select distinct on (pid) pid, r.status, r.new_candidate_id, r.previous_candidate_id, r.created_at, r.resignation_url, r.id_card_url
    from rehire_requests r, lateral (values (r.previous_candidate_id),(r.new_candidate_id)) v(pid)
    where pid is not null order by pid, r.created_at desc),
  people as (
    select e.id, rl.id rec_id, e.full_name, e.code, 'onboarding'::text purpose, coalesce(e.start_date, rl.onboarded_at::text) st,
      coalesce(e.evidence,'{}') || coalesce(ee.ks,'{}') || coalesce(re.ks,'{}') ev, coalesce(dt.ks,'{}') det, e.active act
    from emp e left join rec_link rl on rl.employee_candidate_id=e.id left join emp_ev ee on ee.cid=e.id left join rec_ev re on re.rid=rl.id left join emp_det dt on dt.cid=e.id
    where e.active
    union all
    select e.id, null, e.full_name, e.code, 'offboarding', e.exit_date,
      coalesce(e.evidence,'{}') || coalesce(ee.ks,'{}') || coalesce(re.ks,'{}'), coalesce(dt.ks,'{}'), e.active
    from emp e left join rec_link rl on rl.employee_candidate_id=e.id left join emp_ev ee on ee.cid=e.id left join rec_ev re on re.rid=rl.id left join emp_det dt on dt.cid=e.id
    where e.exit_pending
    union all
    select e.id, null, e.full_name, e.code, 'rehire', h.created_at::text,
      coalesce(e.evidence,'{}') || coalesce(ee.ks,'{}') || coalesce(re.ks,'{}')
        || case when coalesce(h.resignation_url,'')<>'' then array['resignation'] else '{}'::text[] end
        || case when coalesce(h.id_card_url,'')<>'' then array['id_card'] else '{}'::text[] end, coalesce(dt.ks,'{}'), e.active
    from emp e join rh h on h.pid=e.id left join rec_link rl on rl.employee_candidate_id=e.id left join emp_ev ee on ee.cid=e.id left join rec_ev re on re.rid=rl.id left join emp_det dt on dt.cid=e.id
    where coalesce(h.status,'') not in ('rejected','cancelled') and e.id = coalesce(h.new_candidate_id, h.previous_candidate_id)
    union all
    select r.id, r.id, r.full_name, coalesce(r.code,''), 'onboarding', nullif(r.offer->>'joining_date',''), coalesce(re.ks,'{}'),
      case when coalesce(r.mobile,'')<>'' then array['mobile'] else '{}'::text[] end, true
    from rec_candidates r left join rec_ev re on re.rid=r.id
    where r.employee_candidate_id is null and coalesce(r.stage,'') not in ('rejected','withdrawn')
  ),
  scored as (
    select p.*, array(select k from unnest(pol.required_keys) k where not (k = any(p.ev))) miss,
      array(select k from unnest(pol.required_details) k where not (k = any(p.det))
        and (p.rec_id is distinct from p.id or k='mobile')) mdet,
      case when p.st ~ '^\d{4}-\d{2}-\d{2}' then left(p.st,10)::date + pol.deadline_days end dd
    from people p join pol on pol.purpose=p.purpose
  )
  select s.id, s.rec_id, s.full_name, s.code, s.purpose, s.st, s.miss, s.mdet, s.dd, (s.dd is not null and s.dd < (select d from today)), s.act
  from scored s where cardinality(s.miss) > 0 or cardinality(s.mdet) > 0;
end $$;
revoke all on function public.document_followup_pending() from public, anon;
grant execute on function public.document_followup_pending() to authenticated;

create function public.document_followup_summary(p_status text default 'active')
returns jsonb language sql stable security definer set search_path=public as $$
  with p as (select * from public.document_followup_pending() x
    where coalesce(p_status,'all')='all' or (p_status='active') = x.active)
  select jsonb_build_object(
    'people', (select count(distinct coalesce(rec_id,id)) from p),
    'overdue', (select count(*) from p where overdue),
    'types', coalesce((select jsonb_object_agg(k, n) from (select k, count(*) n from p, unnest(p.missing) k group by k) t), '{}'::jsonb),
    'details', coalesce((select jsonb_object_agg(k, n) from (select k, count(*) n from p, unnest(p.missing_details) k group by k) t), '{}'::jsonb));
$$;
revoke all on function public.document_followup_summary(text) from public, anon;
grant execute on function public.document_followup_summary(text) to authenticated;

create function public.document_followup_list(p_type text default null, p_purpose text default null, p_overdue boolean default false, p_words text[] default '{}', p_offset int default 0, p_limit int default 15, p_status text default 'active')
returns jsonb language sql stable security definer set search_path=public as $$
  with f as (
    select p.* from public.document_followup_pending() p
    where (p_type is null or p_type = any(p.missing) or p_type = any(p.missing_details))
      and (p_purpose is null or p.purpose = p_purpose)
      and (coalesce(p_status,'all')='all' or (p_status='active') = p.active)
      and (not coalesce(p_overdue,false) or p.overdue)
      and not exists (select 1 from unnest(coalesce(p_words,'{}')) w where w<>'' and position(lower(w) in lower(coalesce(p.full_name,'')||' '||coalesce(p.code,''))) = 0)
  )
  select jsonb_build_object('total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(to_jsonb(x)) from (select * from f order by overdue desc, due nulls last, full_name, id, purpose offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) x), '[]'::jsonb));
$$;
revoke all on function public.document_followup_list(text,text,boolean,text[],int,int,text) from public, anon;
grant execute on function public.document_followup_list(text,text,boolean,text[],int,int,text) to authenticated;
notify pgrst, 'reload schema';
