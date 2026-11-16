BEGIN;
CREATE TEMP TABLE mapping_fixture AS
 SELECT (SELECT u.id FROM auth.users u JOIN public.candidates c ON u.email='phone-'||c.mobile||'@radiantguard.local' WHERE c.role_key='super_admin' LIMIT 1) actor,
 (SELECT id FROM public.candidates WHERE role_key='field_officer' AND status IN ('active','approved') AND is_enabled ORDER BY id LIMIT 1) fo,
 (SELECT id FROM public.candidates WHERE role_key='operations_manager' AND status IN ('active','approved') AND is_enabled ORDER BY id LIMIT 1) om,
 ARRAY(SELECT id FROM public.units WHERE status='active' ORDER BY id LIMIT 2) ids;
CREATE TEMP TABLE homes_before AS SELECT id,unit_id FROM public.candidates;
CREATE TEMP TABLE attendance_before AS SELECT count(*) n FROM public.attendance_entries;
GRANT SELECT ON mapping_fixture, homes_before, attendance_before TO authenticated;
SELECT set_config('request.jwt.claim.sub',actor::text,true),set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true) FROM mapping_fixture;
SET LOCAL ROLE authenticated;
DO $$DECLARE f record; n integer; BEGIN
 SELECT * INTO f FROM mapping_fixture;
 n:=public.bulk_assign_operational_units(f.ids,f.fo,'field_officer','add');
 IF n<>2 THEN RAISE EXCEPTION 'Add two sites failed'; END IF;
 n:=public.bulk_assign_operational_units(f.ids,f.fo,'field_officer','add');
 IF n<>2 THEN RAISE EXCEPTION 'Repeat add failed'; END IF;
 n:=public.bulk_assign_operational_units(f.ids,f.fo,'field_officer','replace');
 IF n<>2 THEN RAISE EXCEPTION 'Replace officer failed'; END IF;
 n:=public.bulk_assign_operational_units(f.ids,f.om,'operations_manager','add');
 IF n<>2 THEN RAISE EXCEPTION 'Add manager failed'; END IF;
 n:=public.bulk_assign_operational_units(f.ids,f.om,'operations_manager','replace');
 IF n<>2 OR (SELECT count(*) FROM public.units WHERE id=ANY(f.ids) AND operations_manager_id=f.om)<>2 THEN RAISE EXCEPTION 'Replace manager readback failed'; END IF;
 BEGIN
 PERFORM public.bulk_assign_operational_units(f.ids,f.fo,'operations_manager','add');
 RAISE EXCEPTION 'Expected mismatch rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Select an active employee%' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: add, idempotent add, officer replace, manager add/replace/readback, wrong role rejected';
END $$;
RESET ROLE;
DO $$BEGIN
 IF EXISTS (SELECT 1 FROM public.candidates c JOIN homes_before b USING(id) WHERE c.unit_id IS DISTINCT FROM b.unit_id) THEN RAISE EXCEPTION 'Payroll home changed'; END IF;
 IF (SELECT count(*) FROM public.attendance_entries)<>(SELECT n FROM attendance_before) THEN RAISE EXCEPTION 'Attendance changed'; END IF;
 RAISE NOTICE 'PASS: payroll homes and attendance preserved';
END $$;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $$DECLARE f record; BEGIN
 SELECT * INTO f FROM mapping_fixture;
 BEGIN
 PERFORM public.bulk_assign_operational_units(f.ids,f.fo,'field_officer','add');
 RAISE EXCEPTION 'Expected unauthenticated rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'You do not have permission%' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: no-session write rejected';
END $$;
ROLLBACK;
