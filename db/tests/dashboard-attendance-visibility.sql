\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='90s';
-- Existing vehicle manager permissions and no unrelated employee write grant.
SELECT set_config('request.jwt.claim.sub','a78dd340-84da-4d3c-98bd-b6e5fe4e4f9a',true);
DO $$DECLARE result jsonb; BEGIN
 IF NOT current_user_has_permission('vehicles','','view') OR NOT current_user_has_permission('vehicles','trips','view') THEN RAISE EXCEPTION 'Shahid trip view denied'; END IF;
 IF current_user_module_access('employees','edit') THEN RAISE EXCEPTION 'Unrequested employee edit access'; END IF;
 result:=dashboard_attendance_people();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'rows') r WHERE r->>'id'<>'96604755-1098-43c3-a03b-5d8558077a1a') THEN RAISE EXCEPTION 'Unmapped employee exposed to Shahid'; END IF;
END $$;
CREATE TEMP TABLE attendance_fixture(id uuid,kind text);
INSERT INTO attendance_fixture SELECT gen_random_uuid(),k FROM unnest(ARRAY['manager','present','unmarked','outsider']) k;
INSERT INTO candidates(id,full_name,mobile,role_key,status,is_enabled,unit_id,reports_to)
SELECT id,'Attendance visibility rollback '||kind,'fixture-'||id,'transport','active',true,'0889cfb4-7fd6-44b4-bbac-7d7026e33f0f',CASE WHEN kind IN ('present','unmarked') THEN (SELECT id FROM attendance_fixture WHERE kind='manager') ELSE null END FROM attendance_fixture;
-- Use Shahid's real authenticated identity as the manager only inside rollback.
UPDATE candidates SET reports_to='96604755-1098-43c3-a03b-5d8558077a1a' WHERE id IN(SELECT id FROM attendance_fixture WHERE kind IN ('present','unmarked'));
INSERT INTO self_attendance_punches(candidate_id,unit_id,punch_date,check_in_at,check_in_lat,check_in_lng,check_out_at)
SELECT id,'0889cfb4-7fd6-44b4-bbac-7d7026e33f0f',(now() AT TIME ZONE 'Asia/Kolkata')::date,now()-interval '2 hours',18.46746,73.90188,now()-interval '1 hour' FROM attendance_fixture WHERE kind='present';
SET LOCAL ROLE authenticated;
DO $$DECLARE result jsonb; row_data jsonb; BEGIN
 result:=dashboard_attendance_people(_search=>'visibility rollback');
 IF (result->>'filteredTotal')::integer<>2 THEN RAISE EXCEPTION 'Mapped/unmapped visibility failed'; END IF;
 IF jsonb_array_length(dashboard_attendance_people(_search=>'visibility rollback',_filter=>'present')->'rows')<>1 THEN RAISE EXCEPTION 'One present must not make whole team present'; END IF;
 IF jsonb_array_length(dashboard_attendance_people(_search=>'visibility rollback',_filter=>'not_present')->'rows')<>1 THEN RAISE EXCEPTION 'Unmarked staff lost'; END IF;
 SELECT r INTO row_data FROM jsonb_array_elements(result->'rows') r WHERE r->>'full_name' LIKE '%present';
 IF (row_data->>'check_in_lat')::numeric<>18.46746 OR (row_data->>'check_in_lng')::numeric<>73.90188 THEN RAISE EXCEPTION 'Saved coordinates changed'; END IF;
 IF NOT (row_data->>'present_today')::boolean OR row_data->>'check_out_at' IS NULL THEN RAISE EXCEPTION 'Checkout erased present today'; END IF;
 IF jsonb_array_length(dashboard_attendance_people(_search=>'visibility rollback',_filter=>'on_duty')->'rows')<>0 THEN RAISE EXCEPTION 'Checked-out employee counted on duty'; END IF;
END $$;
RESET ROLE;
-- Global admin reaches every eligible fixture, without duplicate people.
SELECT set_config('request.jwt.claim.sub','64d00e62-dc53-4cf1-b22e-5aadc0ca42f1',true);
SET LOCAL ROLE authenticated;
DO $$DECLARE result jsonb; BEGIN
 result:=dashboard_attendance_people(_search=>'visibility rollback');
 IF (result->>'filteredTotal')::integer<>4 THEN RAISE EXCEPTION 'Super admin cannot view all fixture staff'; END IF;
 IF jsonb_array_length(dashboard_attendance_people(_search=>'visibility rollback',_filter=>'present')->'rows')<>1 THEN RAISE EXCEPTION 'Global present count duplicated'; END IF;
END $$;
RESET ROLE;
-- Mapping through the additional-manager table also grants scoped viewing.
INSERT INTO candidate_reporting_managers(candidate_id,manager_id,is_primary,source)
SELECT id,'96604755-1098-43c3-a03b-5d8558077a1a',false,'manual' FROM attendance_fixture WHERE kind='outsider';
SELECT set_config('request.jwt.claim.sub','a78dd340-84da-4d3c-98bd-b6e5fe4e4f9a',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (dashboard_attendance_people(_search=>'visibility rollback')->>'filteredTotal')::integer<>3 THEN RAISE EXCEPTION 'Secondary-manager mapping omitted'; END IF;
 IF jsonb_array_length(dashboard_attendance_people(_search=>'rollback visibility',_page=>1)->'rows')<>0 THEN RAISE EXCEPTION 'Pagination or word-order search failed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF (dashboard_attendance_people()->>'total')::integer<>0 THEN RAISE EXCEPTION 'Unsigned access'; END IF;
 IF has_function_privilege('anon','public.dashboard_attendance_people(date,text,text,integer)','execute') THEN RAISE EXCEPTION 'Anonymous location access'; END IF;
 RAISE NOTICE 'PASS mapped staff isolation, exact present count, unmarked visibility, checkout distinction, saved GPS, no employee edit and unsigned denial';
END $$;
ROLLBACK;
