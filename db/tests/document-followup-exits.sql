\set ON_ERROR_STOP on
begin;
set local statement_timeout='90s';
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where email='phone-8373914073@radiantguard.local' limit 1),'role','authenticated')::text,true) as claims \gset
create temporary table fixture as select gen_random_uuid() id;
insert into public.candidates(id, full_name, mobile, role_key, status, is_enabled)
select id, 'Exit follow-up rollback test', 'test-'||id::text, 'guard', 'inactive',false from fixture;
set local role authenticated;
do $$declare x record; s jsonb; l jsonb; begin
 if not public.current_user_can_recruit() then raise exception 'Fixture account cannot read recruitment'; end if;
 select * into x from public.document_followup_pending() where full_name='Exit follow-up rollback test' and purpose='offboarding';
 if x.id is null or x.missing <> array['resignation','id_card'] or x.missing_details <> array['last_working_date','exit_reason'] or x.due is not null then raise exception 'Disabled employee incomplete-exit assertion failed'; end if;
 s:=public.document_followup_summary('exits',null,null);
 l:=public.document_followup_list(null,null,false,'{}',0,15,'exits',null,null);
 if (s->>'people')::int <> (l->>'total')::int or (s->>'exits')::int <> (l->>'total')::int then raise exception 'Count/list mismatch'; end if;
 raise notice 'PASS disabled employee documents/details; no invented deadline; exit count/list agree (%)',s->>'exits';
end $$;
reset role;
insert into public.employee_document_receipts(candidate_id,document_key,file_path,file_name)
select id,k,'rollback-only/'||id::text||'/'||k,'test.pdf' from fixture cross join unnest(array['resignation','id_card']) k;
set local role authenticated;
do $$declare x record; begin
 select * into x from public.document_followup_pending() where full_name='Exit follow-up rollback test' and purpose='offboarding';
 if x.id is null or cardinality(x.missing)<>0 or cardinality(x.missing_details)<>2 then raise exception 'Detail-only follow-up lost'; end if;
 raise notice 'PASS files received still keeps missing exit details';
end $$;
reset role;
update public.candidates set offboarding_details='{"date_of_last_working":"2026-11-17","reason_text":"Resigned"}' where id=(select id from fixture);
set local role authenticated;
do $$begin
 if exists(select 1 from public.document_followup_pending() where full_name='Exit follow-up rollback test' and purpose='offboarding') then raise exception 'Complete exit did not clear'; end if;
 raise notice 'PASS completed checklist clears follow-up';
end $$;
reset role;
update public.candidates set status='active',is_enabled=true where id=(select id from fixture);
set local role authenticated;
do $$begin
 if exists(select 1 from public.document_followup_pending() where full_name='Exit follow-up rollback test' and purpose='offboarding') then raise exception 'Reactivated employee retains old exit follow-up'; end if;
 raise notice 'PASS active rehire excludes old exit';
end $$;
reset role;
update public.candidates set offboarding_details='{"collection_status":"pending"}' where id=(select id from fixture);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.document_followup_pending() where full_name='Exit follow-up rollback test' and purpose='offboarding' and active) then raise exception 'Pending collection omitted'; end if;
 raise notice 'PASS pending collection remains visible before disable';
end $$;
reset role;
select set_config('request.jwt.claims','{}',true) as claims \gset
set local role authenticated;
do $$begin
 begin
  perform public.document_followup_summary('exits',null,null);
  raise exception 'Unsigned caller unexpectedly read exit documents';
 exception when insufficient_privilege then raise notice 'PASS unsigned caller denied'; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where email='phone-8373914073@radiantguard.local' limit 1),'role','authenticated')::text,true) as claims \gset
set local role authenticated;
select public.document_followup_summary('active',null,null)->>'exits' as live_pending_exit_count;
rollback;
