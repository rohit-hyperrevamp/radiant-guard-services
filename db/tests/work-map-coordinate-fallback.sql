\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='90s';
CREATE TEMP TABLE map_test_context(manager uuid,driver uuid);
INSERT INTO map_test_context SELECT (select id from candidates where employee_code='26881' and full_name='Shahid Hussain'),(select driver_id from transport_team_members order by driver_id limit 1);
GRANT SELECT ON map_test_context TO authenticated;
DELETE FROM self_attendance_punches WHERE candidate_id=(select driver from map_test_context) AND punch_date=(now() AT TIME ZONE 'Asia/Kolkata')::date;
INSERT INTO self_attendance_punches(candidate_id,unit_id,punch_date,check_in_at,check_in_lat,check_in_lng,check_in_accuracy,last_seen_at,last_lat,last_lng)
SELECT driver,(select unit_id from candidates where id=driver),(now() AT TIME ZONE 'Asia/Kolkata')::date,now()-interval '1 hour',18.46746,73.90188,10,now(),NULL,73.91 FROM map_test_context;
SELECT set_config('request.jwt.claim.sub',get_user_id_by_candidate((select manager from map_test_context))::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE row jsonb; BEGIN
 SELECT r INTO row FROM jsonb_array_elements(work_map_people('transport')->'rows') r WHERE r->>'id'=(select driver::text from map_test_context);
 IF row IS NULL OR (row->>'lat')::numeric<>18.46746 OR (row->>'lng')::numeric<>73.90188 OR row->>'location_source'<>'check_in' THEN RAISE EXCEPTION 'Incomplete telemetry erased valid attendance GPS'; END IF;
 IF (row->>'accuracy')::numeric<>10 OR NOT (row->>'present')::boolean THEN RAISE EXCEPTION 'Coordinate fallback changed GPS accuracy or presence'; END IF;
 RAISE NOTICE 'PASS incomplete telemetry retains exact check-in coordinates, source, accuracy and attendance';
END $$;
RESET ROLE;
ROLLBACK;