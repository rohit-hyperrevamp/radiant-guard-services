create or replace function public.document_followup_employees()
returns table(id uuid, full_name text, code text, active boolean, start_date text, exit_date text, exit_pending boolean, evidence text[])
language sql stable security invoker set search_path=public as $$
  select c.id, c.full_name, coalesce(nullif(c.employee_code,''), c.candidate_code, ''),
    (c.status is distinct from 'inactive' and c.is_enabled is distinct from false),
    c.preferred_joining_date::text,
    coalesce(c.offboarding_details->>'date_of_offboarding', c.offboarded_at::text, c.offboarding_details->>'collection_requested_at'),
    (c.offboarding_details->>'date_of_offboarding' is not null or c.offboarded_at is not null or c.offboarding_details->>'collection_status'='pending'),
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
  where (c.status is distinct from 'inactive' and c.is_enabled is distinct from false)
     or c.offboarding_details->>'date_of_offboarding' is not null or c.offboarded_at is not null or c.offboarding_details->>'collection_status'='pending'
     or exists (select 1 from rehire_requests r where r.previous_candidate_id=c.id or r.new_candidate_id=c.id);
$$;
grant execute on function public.document_followup_employees() to authenticated;
