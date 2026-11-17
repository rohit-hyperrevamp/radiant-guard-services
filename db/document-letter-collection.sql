-- Issued copies are immutable; only actual returned files satisfy signature collection.
ALTER TABLE public.employee_signed_documents ADD COLUMN IF NOT EXISTS issued_at timestamptz;
ALTER TABLE public.employee_document_receipts ADD COLUMN IF NOT EXISTS letter_copy_id uuid REFERENCES public.employee_signed_documents(id);
CREATE INDEX IF NOT EXISTS document_receipts_letter_idx ON public.employee_document_receipts(letter_copy_id) WHERE letter_copy_id IS NOT NULL;
CREATE POLICY document_receipts_self_read ON public.employee_document_receipts FOR SELECT TO authenticated USING (candidate_id=(select public.current_user_candidate_id()));
CREATE POLICY document_receipts_self_insert ON public.employee_document_receipts FOR INSERT TO authenticated WITH CHECK (
 candidate_id=(select public.current_user_candidate_id()) AND rec_candidate_id IS NULL AND uploaded_by=(select auth.uid())
 AND split_part(file_path,'/',1)='followup' AND split_part(file_path,'/',2)=candidate_id::text
 AND EXISTS(select 1 from storage.objects o where o.bucket_id='recruitment' and o.name=file_path)
 AND (letter_copy_id IS NULL OR EXISTS(select 1 from public.employee_signed_documents d where d.id=letter_copy_id AND d.candidate_id=candidate_id AND d.issued_at IS NOT NULL)));
CREATE POLICY document_followup_self_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='recruitment' AND split_part(name,'/',1)='followup' AND split_part(name,'/',2)=(select public.current_user_candidate_id())::text);
CREATE POLICY document_followup_self_files_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='recruitment' AND split_part(name,'/',1)='followup' AND split_part(name,'/',2)=(select public.current_user_candidate_id())::text);
CREATE POLICY document_followup_self_files_cleanup ON storage.objects FOR DELETE TO authenticated USING (bucket_id='recruitment' AND split_part(name,'/',1)='followup' AND split_part(name,'/',2)=(select public.current_user_candidate_id())::text AND NOT EXISTS(select 1 from public.employee_document_receipts r where r.file_path=name));
CREATE OR REPLACE FUNCTION public.document_followup_pending_for(p_candidate uuid)
 RETURNS TABLE(id uuid, rec_id uuid, full_name text, code text, purpose text, start_date text, missing text[], missing_details text[], due date, overdue boolean, active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or not (public.current_user_can_recruit() or (p_candidate is not null and p_candidate=public.current_user_candidate_id())) then raise exception 'Not allowed' using errcode='42501'; end if;
  return query
  with pol as (select p.purpose, p.required_keys, p.required_details, p.deadline_days from employee_document_policies p),
  today as (select (now() at time zone 'Asia/Kolkata')::date d),
  emp as (select * from public.document_followup_employees() e where p_candidate is null or e.id=p_candidate),
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
    where p_candidate is null and r.employee_candidate_id is null and coalesce(r.stage,'') not in ('rejected','withdrawn')
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
  return query
  select c.id, null::uuid, c.full_name, coalesce(c.employee_code,c.candidate_code,''),
    case when d.rendered_body::jsonb->>'kind' in ('termination','experience','relieving') then 'offboarding' else 'onboarding' end,
    d.issued_at::text, array['signed_'||(d.rendered_body::jsonb->>'kind')], '{}'::text[],
    (d.issued_at at time zone 'Asia/Kolkata')::date + coalesce(pol.deadline_days,10),
    (d.issued_at at time zone 'Asia/Kolkata')::date + coalesce(pol.deadline_days,10) < (now() at time zone 'Asia/Kolkata')::date,
    c.status is distinct from 'inactive' and c.is_enabled is distinct from false
  from employee_signed_documents d join candidates c on c.id=d.candidate_id
  left join employee_document_policies pol on pol.purpose=case when d.rendered_body::jsonb->>'kind' in ('termination','experience','relieving') then 'offboarding' else 'onboarding' end
  where d.issued_at is not null and (p_candidate is null or c.id=p_candidate)
    and not exists(select 1 from employee_document_receipts r where r.letter_copy_id=d.id and r.candidate_id=c.id);
end $function$;


REVOKE ALL ON FUNCTION public.document_followup_pending_for(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.document_followup_pending_for(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.document_followup_pending()
RETURNS TABLE(id uuid,rec_id uuid,full_name text,code text,purpose text,start_date text,missing text[],missing_details text[],due date,overdue boolean,active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH p AS MATERIALIZED (select * from public.document_followup_pending_for(null)),
 files AS (select id,purpose,array_agg(distinct k order by k) ks from p,unnest(missing) k group by id,purpose),
 details AS (select id,purpose,array_agg(distinct k order by k) ks from p,unnest(missing_details) k group by id,purpose)
 select p.id,p.rec_id,p.full_name,p.code,p.purpose,min(p.start_date),
 coalesce(f.ks,'{}'),coalesce(d.ks,'{}'),min(p.due),bool_or(p.overdue),bool_or(p.active)
 from p left join files f on f.id=p.id and f.purpose=p.purpose left join details d on d.id=p.id and d.purpose=p.purpose
 group by p.id,p.rec_id,p.full_name,p.code,p.purpose,f.ks,d.ks;
$$;
CREATE OR REPLACE FUNCTION public.my_document_followup() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.document_followup_pending_for(public.current_user_candidate_id()) p where p.id=public.current_user_candidate_id(); $$;
REVOKE ALL ON FUNCTION public.my_document_followup() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.my_document_followup() TO authenticated;
CREATE OR REPLACE FUNCTION public.notify_document_followup(p_candidate uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recipient uuid; body text; nid uuid; BEGIN
 IF auth.uid() IS NULL OR NOT public.current_user_module_access('recruitment','edit') OR NOT public.guard_absence_access_allowed() THEN RAISE EXCEPTION 'Not allowed' USING errcode='42501'; END IF;
 SELECT string_agg(x.k,', ' ORDER BY x.k) INTO body FROM (select distinct unnest(p.missing||p.missing_details) k from public.document_followup_pending_for(p_candidate) p) x;
 IF body IS NULL THEN RETURN jsonb_build_object('status','complete'); END IF;
 recipient:=public.get_user_id_by_candidate_id(p_candidate);
 IF recipient IS NULL THEN RETURN jsonb_build_object('status','no_account'); END IF;
 perform pg_advisory_xact_lock(hashtext('document-reminder-'||p_candidate::text));
 IF EXISTS(select 1 from notifications n where n.user_id=recipient AND n.type='document_followup' AND n.created_at>now()-interval '24 hours' AND n.message='Please upload or share these pending documents and details with Radiant HR: '||replace(body,'_',' ')) THEN RETURN jsonb_build_object('status','already_sent'); END IF;
 INSERT INTO notifications(user_id,actor_id,type,title,message,link,entity_type,entity_id) VALUES(recipient,auth.uid(),'document_followup','Documents and details pending','Please upload or share these pending documents and details with Radiant HR: '||replace(body,'_',' '),'/admin/profile','candidates',p_candidate::text) RETURNING id INTO nid;
 RETURN jsonb_build_object('status','sent','id',nid);
END $$;
REVOKE ALL ON FUNCTION public.notify_document_followup(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.notify_document_followup(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_letter_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.letter_copy_id IS NOT NULL AND NOT EXISTS(select 1 from employee_signed_documents d where d.id=NEW.letter_copy_id AND d.candidate_id=NEW.candidate_id AND d.issued_at IS NOT NULL AND NEW.document_key='signed_'||(d.rendered_body::jsonb->>'kind')) THEN RAISE EXCEPTION 'Signed upload must match the issued employee letter'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_letter_receipt BEFORE INSERT OR UPDATE ON public.employee_document_receipts FOR EACH ROW EXECUTE FUNCTION public.validate_letter_receipt();
CREATE OR REPLACE FUNCTION public.protect_issued_letter() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.issued_at IS NOT NULL AND (TG_OP='DELETE' OR NEW.rendered_body IS DISTINCT FROM OLD.rendered_body OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id OR NEW.issued_at IS DISTINCT FROM OLD.issued_at) THEN RAISE EXCEPTION 'Issued letters are retained unchanged; save a new copy'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER protect_issued_letter BEFORE UPDATE OR DELETE ON public.employee_signed_documents FOR EACH ROW EXECUTE FUNCTION public.protect_issued_letter();
NOTIFY pgrst,'reload schema';
