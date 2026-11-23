\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='90s';
-- Test records and notifications are uncommitted and always rolled back.
CREATE TEMP TABLE task_check_context(creator uuid,a uuid,b uuid,outsider uuid,gid uuid,task_a uuid,task_b uuid);
INSERT INTO task_check_context(creator,a,b,outsider)
SELECT (select id from candidates where full_name='Noor Singh' and employee_code='494185'),
 (select c.id from candidates c join auth.users u on u.email='phone-'||c.mobile||'@radiantguard.local' where c.is_enabled and c.status='active' and c.role_key='transport' order by c.id limit 1),
 (select c.id from candidates c join auth.users u on u.email='phone-'||c.mobile||'@radiantguard.local' where c.is_enabled and c.status='active' and c.role_key='hr' order by c.id limit 1),
 (select c.id from candidates c join auth.users u on u.email='phone-'||c.mobile||'@radiantguard.local' where c.is_enabled and c.status='active' and c.role_key='guard' order by c.id limit 1);
GRANT ALL ON task_check_context TO authenticated;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select creator from task_check_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x record; g uuid; BEGIN
 SELECT * INTO x FROM task_check_context;
 IF x.creator IS NULL OR x.a IS NULL OR x.b IS NULL OR x.outsider IS NULL THEN RAISE EXCEPTION 'Test accounts unavailable'; END IF;
 g:=create_task_group('Rollback verification task','Two independent recipients',ARRAY[]::uuid[],ARRAY[x.a,x.a,x.b],now()+interval '4 hours','medium');
 IF (select count(*) from tasks where assignment_group_id=g)<>2 THEN RAISE EXCEPTION 'Duplicate recipients not folded'; END IF;
 UPDATE task_check_context SET gid=g,task_a=(select id from tasks where assignment_group_id=g and assignee_id=x.a),task_b=(select id from tasks where assignment_group_id=g and assignee_id=x.b);
 IF (select count(*) from task_events where task_id IN(select id from tasks where assignment_group_id=g) and kind='created')<>2 THEN RAISE EXCEPTION 'Creation events missing'; END IF;
 IF (task_summary_counts()->'created'->>'total')::int<>(select count(distinct coalesce(assignment_group_id,id)) from tasks where created_by=x.creator) THEN RAISE EXCEPTION 'Group count mismatch'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select a from task_check_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x record; BEGIN
 SELECT * INTO x FROM task_check_context;
 IF EXISTS(select 1 from tasks where id=x.task_b) THEN RAISE EXCEPTION 'Sibling employee assignment exposed'; END IF;
 PERFORM task_action(x.task_a,'acknowledge');
 PERFORM task_action(x.task_a,'complete','First submission',NULL,ARRAY[x.task_a::text||'/rollback-proof.jpg']);
 IF NOT EXISTS(select 1 from tasks where id=x.task_a and status='completed' and review_status='pending') THEN RAISE EXCEPTION 'Submission did not await review'; END IF;
 BEGIN PERFORM task_action(x.task_a,'accept'); RAISE EXCEPTION 'Assignee accepted own work'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Assignee accepted own work' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select creator from task_check_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x record; deadline timestamptz:=now()+interval '1 hour'; BEGIN
 SELECT * INTO x FROM task_check_context;
 BEGIN PERFORM task_action(x.task_a,'reopen','',deadline); RAISE EXCEPTION 'Empty feedback accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Empty feedback accepted' THEN RAISE; END IF; END;
 BEGIN PERFORM task_action(x.task_a,'reopen','Correct it',now()-interval '1 minute'); RAISE EXCEPTION 'Past deadline accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Past deadline accepted' THEN RAISE; END IF; END;
 PERFORM task_action(x.task_a,'reopen','Please correct the evidence',deadline);
 IF NOT EXISTS(select 1 from tasks where id=x.task_a and status='open' and review_status='returned' and due_at=deadline and feedback='Please correct the evidence' and acknowledged_at IS NULL and cardinality(proof_paths)=1) THEN RAISE EXCEPTION 'Returned task/deadline/proofs not preserved'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select a from task_check_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM task_action((select task_a from task_check_context),'complete','Corrected submission',NULL,ARRAY[(select task_a::text from task_check_context)||'/rollback-corrected.jpg']); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select creator from task_check_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x record; BEGIN
 SELECT * INTO x FROM task_check_context; PERFORM task_action(x.task_a,'accept','Accepted after correction');
 IF NOT EXISTS(select 1 from tasks where id=x.task_a and review_status='accepted' and cardinality(proof_paths)=2) THEN RAISE EXCEPTION 'Acceptance or evidence history lost'; END IF;
 IF (select count(*) from task_events where task_id=x.task_a and kind='complete')<>2 THEN RAISE EXCEPTION 'Resubmission history lost'; END IF;
 IF has_table_privilege('authenticated','public.tasks','DELETE') OR has_table_privilege('authenticated','public.tasks','UPDATE') THEN RAISE EXCEPTION 'Task history can be bypassed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select outsider from task_check_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM task_action((select task_b from task_check_context),'complete','Not my work'); RAISE EXCEPTION 'Outsider changed task'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Outsider changed task' THEN RAISE; END IF; END;
 IF EXISTS(select 1 from tasks where assignment_group_id=(select gid from task_check_context)) THEN RAISE EXCEPTION 'Outsider read another team task'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 BEGIN PERFORM task_action((select task_a from task_check_context),'comment','Unsigned'); RAISE EXCEPTION 'Unsigned task access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS task grouping, independent visibility, submit/review, required feedback, future deadlines, reopen/resubmit, retained proofs/events and unauthorized denial';
END $$;
ROLLBACK;