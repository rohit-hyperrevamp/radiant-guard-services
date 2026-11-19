\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='90s';
SELECT set_config('request.jwt.claim.sub','a78dd340-84da-4d3c-98bd-b6e5fe4e4f9a',true);
-- Isolate explicit site scope without changing any permanent assignments.
DELETE FROM employee_scope_assignments WHERE candidate_id='96604755-1098-43c3-a03b-5d8558077a1a' AND scope_type='unit';
CREATE TEMP TABLE ho_visibility_fixture AS SELECT gen_random_uuid() id;
INSERT INTO candidates(id,full_name,mobile,role_key,status,is_enabled,unit_id)
SELECT id,'HO scope rollback fixture','fixture-'||id,'transport','active',true,'0889cfb4-7fd6-44b4-bbac-7d7026e33f0f' FROM ho_visibility_fixture;
INSERT INTO self_attendance_punches(candidate_id,unit_id,punch_date,check_in_at,check_in_lat,check_in_lng)
SELECT id,'0889cfb4-7fd6-44b4-bbac-7d7026e33f0f',(now() AT TIME ZONE 'Asia/Kolkata')::date,now(),18.46746,73.90188 FROM ho_visibility_fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (dashboard_attendance_people(_search=>'HO scope rollback fixture')->>'filteredTotal')::integer<>0 THEN RAISE EXCEPTION 'Payroll home alone exposed HO colleagues'; END IF;
END $$;
RESET ROLE;
INSERT INTO employee_scope_assignments(candidate_id,scope_type,scope_id,scope_label)
VALUES('96604755-1098-43c3-a03b-5d8558077a1a','unit','0889cfb4-7fd6-44b4-bbac-7d7026e33f0f','Corporate Office (Pune - HO)');
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=dashboard_attendance_people(_search=>'HO scope rollback fixture');
 IF (r->>'filteredTotal')::integer<>1 THEN RAISE EXCEPTION 'Explicit Radiant HO mapping omitted staff'; END IF;
 IF jsonb_array_length(dashboard_attendance_people(_search=>'HO scope rollback fixture',_filter=>'checked_in')->'rows')<>1 THEN RAISE EXCEPTION 'HO check-in missing'; END IF;
 IF (r->'rows'->0->>'check_in_lat')::numeric<>18.46746 OR (r->'rows'->0->>'check_in_lng')::numeric<>73.90188 THEN RAISE EXCEPTION 'Saved HO GPS changed'; END IF;
 IF current_user_module_access('employees','edit') THEN RAISE EXCEPTION 'Unrequested employee edit access'; END IF;
 RAISE NOTICE 'PASS explicit HO mapping, home-only isolation, saved GPS, check-in and unchanged edit permissions';
END $$;
RESET ROLE;
ROLLBACK;