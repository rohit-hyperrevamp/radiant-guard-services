\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '90s';
CREATE TEMP TABLE hr_checkout_fixture(id uuid,kind text);
INSERT INTO hr_checkout_fixture SELECT gen_random_uuid(),k FROM unnest(ARRAY['due','early','manual','nonhr','other-site','historical']) k;
INSERT INTO public.candidates(id,full_name,mobile,department_id,role_key,status,is_enabled,unit_id)
SELECT id,'Automatic checkout rollback fixture', 'test-'||id,
 CASE WHEN kind='nonhr' THEN 'ccca0b5e-daff-4b21-8a3a-c923a3098455'::uuid ELSE '6e453c4e-b1e2-48fa-bdab-f0c9a354c1af'::uuid END,
 'hr_executive','active',true,'0889cfb4-7fd6-44b4-bbac-7d7026e33f0f' FROM hr_checkout_fixture;
INSERT INTO public.self_attendance_punches(candidate_id,unit_id,punch_date,check_in_at,check_out_at,notes)
SELECT id,CASE WHEN kind='other-site' THEN '3248c96e-a242-4eb8-ba5d-f657376679a1'::uuid ELSE '0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'::uuid END,
 CASE WHEN kind='historical' THEN DATE '2026-11-17' ELSE (now() AT TIME ZONE 'Asia/Kolkata')::date END,
 CASE WHEN kind='early' THEN now()-interval '11 hours 59 minutes' ELSE now()-interval '12 hours' END,
 CASE WHEN kind='manual' THEN now()-interval '1 hour' ELSE NULL END,'Original note'
FROM hr_checkout_fixture;
CREATE TEMP TABLE hr_checkout_before AS SELECT p.* FROM public.self_attendance_punches p WHERE candidate_id IN (SELECT id FROM hr_checkout_fixture);
SELECT public.run_hr_ho_checkout();
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.self_attendance_punches p JOIN hr_checkout_fixture f ON f.id=p.candidate_id
   WHERE f.kind='due' AND p.check_out_at=p.check_in_at+interval '12 hours'
   AND p.notes LIKE 'Original note%' AND p.check_out_lat IS NULL AND p.check_out_photo_path IS NULL
   AND p.check_out_face_verified=false) THEN RAISE EXCEPTION 'Exactly 12h checkout/readback or factual evidence failed'; END IF;
 IF EXISTS (SELECT 1 FROM public.self_attendance_punches p JOIN hr_checkout_fixture f ON f.id=p.candidate_id
   WHERE f.kind IN ('early','nonhr','other-site','historical') AND p.check_out_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Checkout leaked beyond time/department/site/activation boundaries'; END IF;
 IF EXISTS (SELECT 1 FROM public.self_attendance_punches p JOIN hr_checkout_fixture f ON f.id=p.candidate_id
   JOIN hr_checkout_before b ON b.id=p.id WHERE f.kind='manual' AND to_jsonb(p) IS DISTINCT FROM to_jsonb(b))
 THEN RAISE EXCEPTION 'Manual checkout changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.attendance_entries e JOIN hr_checkout_fixture f ON f.id=e.candidate_id
   WHERE f.kind='due' AND e.code='P') THEN RAISE EXCEPTION 'Checkout did not synchronize Present attendance'; END IF;
 IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='hr-ho-auto-checkout' AND active)
 THEN RAISE EXCEPTION 'Pending checkout did not arm deadline'; END IF;
 IF has_function_privilege('authenticated','public.run_hr_ho_checkout()','execute')
 THEN RAISE EXCEPTION 'Browser can invoke privileged checkout'; END IF;
 RAISE NOTICE 'PASS exactly 12h, before 12h, manual preservation, HR/site scope, historical exclusion, evidence, Present sync, deadline and execution permissions';
END $$;
SELECT public.run_hr_ho_checkout();
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.self_attendance_punches p JOIN hr_checkout_fixture f ON f.id=p.candidate_id
 WHERE f.kind='due' AND length(p.notes)-length(replace(p.notes,'Automatic checkout','')) <> length('Automatic checkout'))
 THEN RAISE EXCEPTION 'Repeated execution duplicated automatic checkout'; END IF;
END $$;
ROLLBACK;