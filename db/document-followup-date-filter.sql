-- Add date-aware overloads; old deployed clients retain their existing RPC signatures.
begin;
create or replace function public.document_followup_summary(p_status text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path=public as $$
  with p as (select * from public.document_followup_pending() x
    where (coalesce(p_status,'all')='all' or (p_status='active') = x.active)
      and (p_from is null or left(x.start_date,10) >= p_from::text)
      and (p_to is null or left(x.start_date,10) <= p_to::text))
  select jsonb_build_object(
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
      and (coalesce(p_status,'all')='all' or (p_status='active') = p.active)
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
commit;