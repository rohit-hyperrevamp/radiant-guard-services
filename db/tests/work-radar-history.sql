\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='90s';
CREATE TEMP TABLE radar_context(manager uuid,driver uuid,outsider uuid,officer uuid,site uuid,visit uuid);
INSERT INTO radar_context(manager,driver,outsider,officer,site)
SELECT (select id from candidates where full_name='Shahid Hussain' and employee_code='26881'),
 (select driver_id from transport_team_members order by driver_id limit 1),
 (select c.id from candidates c join designations d on d.id=c.designation_id where lower(d.name)='driver' and c.is_enabled and c.status='active' and c.role_key IS NULL and NOT EXISTS(select 1 from transport_team_members t where t.driver_id=c.id) order by c.id limit 1),
 (select c.id from candidates c where c.role_key='field_officer' and c.is_enabled and c.status='active' and EXISTS(select 1 from field_officer_scope f join units u on u.id=f.unit_id and u.status='active' where f.candidate_id=c.id) order by c.id limit 1),
 (select id from units where status='active' and code like 'CLI%' order by id limit 1);
GRANT ALL ON radar_context TO authenticated;
-- Clear only today's fixtures inside the rollback; actual attendance and punches are restored.
DELETE FROM self_attendance_punches WHERE candidate_id IN(select driver from radar_context) AND punch_date=(now() AT TIME ZONE 'Asia/Kolkata')::date;
INSERT INTO self_attendance_punches(candidate_id,unit_id,punch_date,check_in_at,check_in_lat,check_in_lng,last_lat,last_lng,last_accuracy,last_seen_at)
SELECT driver,(select unit_id from candidates where id=driver),(now() AT TIME ZONE 'Asia/Kolkata')::date,now(),18.46746,73.90188,18.47,73.91,12,now() FROM radar_context;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select manager from radar_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; p jsonb; x record; BEGIN
 SELECT * INTO x FROM radar_context;
 result:=work_map_people('transport');
 IF (result->>'total')::int<>10 THEN RAISE EXCEPTION 'Shahid driver roster must have ten linked active drivers'; END IF;
 SELECT r INTO p FROM jsonb_array_elements(result->'rows') r WHERE r->>'id'=x.driver::text;
 IF p IS NULL OR NOT (p->>'present')::boolean OR (p->>'lat')::numeric<>18.47 OR p->>'location_source'<>'telemetry' THEN RAISE EXCEPTION 'Driver live location or presence missing'; END IF;
 IF EXISTS(select 1 from jsonb_array_elements(result->'rows') r where r->>'id'=x.outsider::text) THEN RAISE EXCEPTION 'Unmapped external driver exposed'; END IF;
 IF current_user_module_access('employees','edit') THEN RAISE EXCEPTION 'Transport received employee-edit access'; END IF;
 IF (result->>'total')::int<>jsonb_array_length(result->'rows') OR (result->>'present')::int<>(select count(*) from jsonb_array_elements(result->'rows') r where (r->>'present')::boolean) THEN RAISE EXCEPTION 'Present and absent totals differ from the saved roster'; END IF;
END $$;
RESET ROLE;
-- Visit form and immutable revisions, using synthetic data visible only in this transaction.
INSERT INTO field_visits(candidate_id,unit_id,visit_date,visit_seq,check_in_at,visit_notes)
SELECT officer,site,(now() AT TIME ZONE 'Asia/Kolkata')::date,9999,now(),'Rollback original notes' FROM radar_context;
UPDATE radar_context SET visit=(select id from field_visits where candidate_id=officer and visit_seq=9999 order by created_at desc limit 1);
UPDATE field_visits SET visit_notes='Rollback corrected notes',check_out_at=now(),customer_rating=5 WHERE id=(select visit from radar_context);
DO $$ DECLARE x record; BEGIN
 SELECT * INTO x FROM radar_context;
 IF (select count(*) from field_visit_history where visit_id=x.visit)<>2 THEN RAISE EXCEPTION 'Visit revision log missing'; END IF;
 IF NOT EXISTS(select 1 from field_visit_history where visit_id=x.visit and form_data->>'visit_notes'='Rollback original notes') THEN RAISE EXCEPTION 'Original form rewritten'; END IF;
 IF (select count(*) from radar_day_assignments where candidate_id=x.officer and assignment_date=(now() AT TIME ZONE 'Asia/Kolkata')::date)=0 THEN RAISE EXCEPTION 'Daily assignment snapshot missing'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select id from candidates where full_name='Noor Singh' and employee_code='494185'))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE history jsonb; x record; summary jsonb; BEGIN
 SELECT * INTO x FROM radar_context;
 history:=radar_employee_history(x.officer,(now() AT TIME ZONE 'Asia/Kolkata')::date,(now() AT TIME ZONE 'Asia/Kolkata')::date);
 IF history->>'rosterSource'<>'saved' OR NOT EXISTS(select 1 from jsonb_array_elements(history->'visits') r where r->>'id'=x.visit::text and r->>'visit_notes'='Rollback corrected notes') THEN RAISE EXCEPTION 'Saved form readback failed'; END IF;
 summary:=radar_visit_summary((now() AT TIME ZONE 'Asia/Kolkata')::date,(now() AT TIME ZONE 'Asia/Kolkata')::date);
 IF summary->'rows' IS NULL THEN RAISE EXCEPTION 'Summary unavailable'; END IF;
 IF has_table_privilege('authenticated','public.field_visit_history','UPDATE') OR has_table_privilege('authenticated','public.field_visit_history','DELETE') THEN RAISE EXCEPTION 'Saved history can be overwritten'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF (work_map_people('transport')->>'total')::int<>0 THEN RAISE EXCEPTION 'Unsigned driver location access'; END IF;
 IF has_function_privilege('anon','public.work_map_people(text,date)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous map access'; END IF;
 RAISE NOTICE 'PASS driver scope, latest GPS, independent presence, preserved permissions, day roster, immutable form revisions, history readback and unsigned denial';
END $$;
ROLLBACK;