\set ON_ERROR_STOP on
begin;
set local statement_timeout='90s';
create temp table test_letter_fixture as select c.id cid,u.id uid,gen_random_uuid() lid from candidates c join auth.users u on u.email='phone-'||c.mobile||'@radiantguard.local' where c.role_key='guard' and c.status='active' limit 1;
insert into employee_signed_documents(id,candidate_id,template_id,doc_type,version,rendered_body,employee_signature_data,company_signature_data,issued_at)
select f.lid,f.cid,t.id,'appointment_letter',t.version,'{"format":"radiant-employment-letter-v1","kind":"confirmation","fields":{},"pages":[]}', '', '',now() from test_letter_fixture f cross join lateral(select * from company_document_templates where doc_type='appointment_letter' and is_active limit 1)t;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select uid from test_letter_fixture),'role','authenticated')::text,true) as claims \gset
set local role authenticated;
do $$declare p jsonb;begin
 p:=public.my_document_followup();
 if not exists(select 1 from jsonb_array_elements(p)x where x->'missing' ? 'signed_confirmation') then raise exception 'Issued confirmation absent from employee checklist';end if;
 if exists(select 1 from jsonb_array_elements(p)x where x->>'id'<>public.current_user_candidate_id()::text) then raise exception 'Cross-employee pending data';end if;
 begin perform public.document_followup_pending_for(gen_random_uuid());raise exception 'Cross-employee read permitted';exception when insufficient_privilege then null;end;
 begin perform public.notify_document_followup(public.current_user_candidate_id());raise exception 'Guard can send HR reminders';exception when insufficient_privilege then null;end;
 raise notice 'PASS employee issued letter visible; other employees denied; HR reminder denied';
end $$;
reset role;
insert into storage.objects(bucket_id,name) select 'recruitment','followup/'||cid||'/signed_confirmation/test.pdf' from test_letter_fixture;
grant select on test_letter_fixture to authenticated;
set local role authenticated;
insert into employee_document_receipts(candidate_id,document_key,file_path,file_name,letter_copy_id)
select cid,'signed_confirmation','followup/'||cid||'/signed_confirmation/test.pdf','test.pdf',lid from test_letter_fixture;
do $$begin
 if exists(select 1 from jsonb_array_elements(public.my_document_followup()) x where x->'missing' ? 'signed_confirmation') then raise exception 'Signed return not cleared'; end if;
 if not exists(select 1 from employee_document_receipts where uploaded_by=auth.uid() and document_key='signed_confirmation') then raise exception 'Own receipt not readable';end if;
 raise notice 'PASS own signed receipt insert/readback clears issued pending item';
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where email='phone-8373914073@radiantguard.local' limit 1),'role','authenticated')::text,true) as claims \gset
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.notify_document_followup((select cid from test_letter_fixture));
 if result->>'status' <> 'sent' then raise exception 'Reminder not delivered: %',result;end if;
 result:=public.notify_document_followup((select cid from test_letter_fixture));
 if result->>'status' <> 'already_sent' then raise exception 'Duplicate reminder created';end if;
 raise notice 'PASS HR reminder created and duplicate suppressed';
end $$;
reset role;
do $$begin
 begin update employee_signed_documents set rendered_body='changed' where id=(select lid from test_letter_fixture);raise exception 'Issued letter mutated';exception when raise_exception then if sqlerrm='Issued letter mutated' then raise;end if;end;
 raise notice 'PASS issued letter immutable';
end $$;
rollback;
