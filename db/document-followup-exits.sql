-- Disabled employees remain in exit follow-up until configured documents and details are complete.
CREATE OR REPLACE FUNCTION public.document_followup_employees()
 RETURNS TABLE(id uuid, full_name text, code text, active boolean, start_date text, exit_date text, exit_pending boolean, evidence text[])
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $body$
  select c.id, c.full_name, coalesce(nullif(c.employee_code,''), c.candidate_code, ''),
    (c.status is distinct from 'inactive' and c.is_enabled is distinct from false),
    c.preferred_joining_date::text,
    coalesce(c.offboarding_details->>'date_of_offboarding', c.offboarded_at::text, c.offboarding_details->>'collection_requested_at'),
    (c.status = 'inactive' or c.is_enabled = false or c.offboarding_details->>'collection_status'='pending'),
    array_remove(array[
      case when c.photo_url is not null and c.photo_url<>'' then 'photo' end,
      case when (c.aadhaar_image_url is not null and c.aadhaar_image_url<>'') or (c.other_info->>'digilocker_verified')::boolean is true or (c.other_info->>'digilocker_verified_aadhaar')::boolean is true then 'aadhaar_front' end,
      case when (c.aadhaar_back_image_url is not null and c.aadhaar_back_image_url<>'') or (c.other_info->>'digilocker_verified')::boolean is true or (c.other_info->>'digilocker_verified_aadhaar')::boolean is true then 'aadhaar_back' end,
      case when c.pan_image_url is not null and c.pan_image_url<>'' then 'pan' end,
      case when c.signature_url is not null and c.signature_url<>'' then 'signature' end
    ]::text[], null)
    || coalesce((select array_agg(distinct coalesce(d->>'document_key', d->>'category')) from jsonb_array_elements(case when jsonb_typeof(c.documents)='array' then c.documents else '[]'::jsonb end) d
        where coalesce(d->>'file_url', d->>'url', d->>'file_path') is not null and coalesce(d->>'document_key', d->>'category') is not null), '{}')
    || coalesce((select array_agg(case d->>'key' when 'resignation_letter' then 'resignation' else 'id_card' end) from jsonb_array_elements(case when jsonb_typeof(c.offboarding_details->'exit_documents')='array' then c.offboarding_details->'exit_documents' else '[]'::jsonb end) d
        where d->>'file_url' is not null and d->>'file_url'<>'' and (d->>'collected') is distinct from 'false' and d->>'key' in ('resignation_letter','id_card_photo')), '{}')
  from candidates c
  where c.status = 'inactive' or c.is_enabled = false
     or (c.status is distinct from 'inactive' and c.is_enabled is distinct from false)
     or c.offboarding_details->>'date_of_offboarding' is not null or c.offboarded_at is not null or c.offboarding_details->>'collection_status'='pending'
     or exists (select 1 from rehire_requests r where r.previous_candidate_id=c.id or r.new_candidate_id=c.id);
$body$;

-- Add date-aware overloads; old deployed clients retain their existing RPC signatures.

create or replace function public.document_followup_summary(p_status text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path=public as $$
  with dated as materialized (select * from public.document_followup_pending() x
    where (p_from is null or left(x.start_date,10) >= p_from::text)
      and (p_to is null or left(x.start_date,10) <= p_to::text)),
  p as (select * from dated x where (coalesce(p_status,'all')='all' or (p_status='exits' and x.purpose='offboarding') or (p_status in ('active','inactive') and (p_status='active') = x.active))
      and (p_from is null or left(x.start_date,10) >= p_from::text)
      and (p_to is null or left(x.start_date,10) <= p_to::text))
  select jsonb_build_object(
    'exits', (select count(distinct id) from dated where purpose='offboarding'),
    'exit_overdue', (select count(*) from dated where purpose='offboarding' and overdue),
    'people', (select count(distinct coalesce(rec_id,id)) from p),
    'overdue', (select count(*) from p where overdue),
    'types', coalesce((select jsonb_object_agg(k,n) from (select k,count(*) n from p, unnest(p.missing) k group by k) t),'{}'::jsonb),
    'details', coalesce((select jsonb_object_agg(k,n) from (select k,count(*) n from p, unnest(p.missing_details) k group by k) t),'{}'::jsonb));
$$;
revoke all on function public.document_followup_summary(text,date,date) from public, anon;
grant execute on function public.document_followup_summary(text,date,date) to authenticated;

create or replace function public.document_followup_list(p_type text, p_purpose text, p_overdue boolean, p_words text[], p_offset int, p_limit int, p_status text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path=public as $$
  with f as (
    select p.* from public.document_followup_pending() p
    where (p_type is null or p_type = any(p.missing) or p_type = any(p.missing_details))
      and (p_purpose is null or p.purpose = p_purpose)
      and (coalesce(p_status,'all')='all' or (p_status='exits' and p.purpose='offboarding') or (p_status in ('active','inactive') and (p_status='active') = p.active))
      and (p_from is null or left(p.start_date,10) >= p_from::text)
      and (p_to is null or left(p.start_date,10) <= p_to::text)
      and (not coalesce(p_overdue,false) or p.overdue)
      and not exists (select 1 from unnest(coalesce(p_words,'{}')) w where w<>'' and position(lower(w) in lower(coalesce(p.full_name,'')||' '||coalesce(p.code,'')))=0)
  )
  select jsonb_build_object('total',(select count(*) from f),
    'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from f order by overdue desc,due nulls last,full_name,id,purpose offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) x),'[]'::jsonb));
$$;
revoke all on function public.document_followup_list(text,text,boolean,text[],int,int,text,date,date) from public, anon;
grant execute on function public.document_followup_list(text,text,boolean,text[],int,int,text,date,date) to authenticated;
notify pgrst, 'reload schema';
