\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='90s';
CREATE TEMP TABLE team_test_context(head uuid,department uuid,outsider uuid);
INSERT INTO team_test_context(head,department,outsider)
SELECT (select id from candidates where employee_code='494185' and full_name='Noor Singh'),gen_random_uuid(),
 (select c.id from candidates c where c.role_key='hr_executive' and c.is_enabled and get_user_id_by_candidate(c.id) is not null limit 1);
GRANT SELECT ON team_test_context TO authenticated;
UPDATE departments SET head_candidate_id=NULL WHERE head_candidate_id=(select head from team_test_context);
INSERT INTO departments(id,name,enabled,head_candidate_id) SELECT department,'Rollback department team',true,head FROM team_test_context;
CREATE TEMP TABLE team_test_members(id uuid primary key,seq int);
INSERT INTO team_test_members SELECT gen_random_uuid(),s FROM generate_series(1,5) s;
GRANT SELECT ON team_test_members TO authenticated;
INSERT INTO candidates(id,full_name,employee_code,status,is_enabled,non_billable,department_id)
SELECT m.id,'Rollback teammate '||m.seq,'TEAM-VERIFY-'||m.seq,'active',true,true,x.department FROM team_test_members m CROSS JOIN team_test_context x;
INSERT INTO self_attendance_punches(candidate_id,punch_date,check_in_at,check_out_at)
SELECT id,(now() AT TIME ZONE 'Asia/Kolkata')::date,now()-interval '1 hour',CASE WHEN seq=1 THEN now() ELSE NULL END FROM team_test_members WHERE seq<=3;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select head from team_test_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result:=dashboard_department_team();
 IF NOT (result->>'isHead')::boolean OR (result->>'total')::int<>5 THEN RAISE EXCEPTION 'Department head must see all five teammates'; END IF;
 IF (result->>'present')::int<>3 OR (result->>'absent')::int<>2 THEN RAISE EXCEPTION 'Five-member team must have three present and two absent; checkout retains presence'; END IF;
 IF jsonb_array_length(dashboard_department_team(_filter=>'present')->'rows')<>3 OR jsonb_array_length(dashboard_department_team(_filter=>'absent')->'rows')<>2 THEN RAISE EXCEPTION 'Present/absent lists disagree with totals'; END IF;
 IF (dashboard_department_team(_search=>'TEAM-VERIFY-2')->>'filteredTotal')::int<>1 THEN RAISE EXCEPTION 'EMP-ID search failed'; END IF;
 IF (dashboard_department_team(_page=>1)->>'total')::int<>5 OR jsonb_array_length(dashboard_department_team(_page=>1)->'rows')<>0 THEN RAISE EXCEPTION 'Paging changed team summary'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'rows') r WHERE r->>'id'=(select head::text from team_test_context)) THEN RAISE EXCEPTION 'Head included in own teammates'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select outsider from team_test_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 IF (dashboard_department_team()->>'total')::int<>0 THEN RAISE EXCEPTION 'Non-head exposed department team'; END IF;
 BEGIN UPDATE departments SET head_candidate_id=(select outsider from team_test_context) WHERE id=(select department from team_test_context); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unprivileged employee changed department head'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF (dashboard_department_team()->>'total')::int<>0 THEN RAISE EXCEPTION 'Unsigned team read exposed staff'; END IF;
 IF has_function_privilege('anon','public.dashboard_department_team(date,text,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous team access'; END IF;
 RAISE NOTICE 'PASS five-member/three-present/two-absent counts, checkout, EMP-ID search, paging, department isolation, head-write protection and unsigned denial';
END $$;
ROLLBACK;