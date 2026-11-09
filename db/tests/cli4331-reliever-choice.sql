-- All synthetic attendance/choices/audits are rolled back; no production duties are added.
BEGIN;
SET LOCAL app.skip_attendance_rules='on';
CREATE TEMP TABLE role_fixture AS
SELECT ae.candidate_id, ae.designation_id, ae.shift_hours, ae.unit_id
FROM attendance_entries ae JOIN candidates c ON c.id=ae.candidate_id
JOIN units u ON u.id=ae.unit_id
WHERE u.code='CLI4331' AND c.employee_code='47434' LIMIT 1;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM role_fixture) THEN RAISE EXCEPTION 'Missing CLI4331 fixture'; END IF;
END $$;
DELETE FROM attendance_entries WHERE candidate_id=(SELECT candidate_id FROM role_fixture)
  AND entry_date BETWEEN '2026-08-01' AND '2026-09-30';
INSERT INTO attendance_entries(candidate_id,unit_id,designation_id,shift_hours,entry_date,code,ot_hours,is_reliever)
SELECT candidate_id,unit_id,designation_id,shift_hours,'2026-09-01','',1,true FROM role_fixture;
INSERT INTO attendance_role_choices(candidate_id,unit_id,month,is_reliever,chosen_by)
SELECT candidate_id,unit_id,'2026-09-01',true,'00000000-0000-0000-0000-000000000001' FROM role_fixture;
SET LOCAL app.skip_attendance_rules='';
DO $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM role_fixture;
  PERFORM apply_guard_attendance_rules(f.candidate_id,'2026-09-01','2026-09-01');
  PERFORM apply_guard_attendance_rules(f.candidate_id,'2026-09-01','2026-09-01');
  IF NOT EXISTS(SELECT 1 FROM attendance_entries WHERE candidate_id=f.candidate_id
    AND unit_id=f.unit_id AND entry_date='2026-09-01' AND code='' AND ot_hours=1 AND is_reliever) THEN
    RAISE EXCEPTION 'Explicit reliever full Extra Duty changed to Present/NP';
  END IF;
  UPDATE attendance_entries SET code='',ot_hours=0.125 WHERE candidate_id=f.candidate_id AND entry_date='2026-09-01';
  IF NOT EXISTS(SELECT 1 FROM attendance_entries WHERE candidate_id=f.candidate_id AND entry_date='2026-09-01'
    AND code='' AND ot_hours=0.125 AND is_reliever) THEN RAISE EXCEPTION 'One-hour Extra Duty lost precision'; END IF;
  UPDATE attendance_entries SET code='P',ot_hours=0 WHERE candidate_id=f.candidate_id AND entry_date='2026-09-01';
  IF NOT EXISTS(SELECT 1 FROM attendance_entries WHERE candidate_id=f.candidate_id AND entry_date='2026-09-01'
    AND code='' AND ot_hours=1 AND is_reliever) THEN RAISE EXCEPTION 'Reliever Present not converted to Extra Duty'; END IF;
  UPDATE attendance_role_choices SET is_reliever=false WHERE candidate_id=f.candidate_id AND unit_id=f.unit_id;
  PERFORM apply_guard_attendance_rules(f.candidate_id,'2026-09-01','2026-09-01');
  IF NOT EXISTS(SELECT 1 FROM attendance_entries WHERE candidate_id=f.candidate_id AND entry_date='2026-09-01'
    AND code='P' AND ot_hours=0 AND NOT is_reliever) THEN RAISE EXCEPTION 'Regular selection did not restore Present'; END IF;
END $$;
-- An unauthenticated caller cannot mutate role selections.
DO $$
DECLARE f record; denied boolean:=false;
BEGIN
  SELECT * INTO f FROM role_fixture;
  BEGIN
    PERFORM save_attendance_role_line(f.candidate_id,f.unit_id,f.designation_id,f.shift_hours,true,'2026-08-21','2026-09-20');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Not authorized to edit this attendance' THEN RAISE; END IF;
    denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unauthenticated role selection permitted'; END IF;
END $$;
-- Exercise the authorized transactional request, still entirely rolled back.
DO $$
DECLARE f record; uid uuid;
BEGIN
  SELECT * INTO f FROM role_fixture;
  SELECT u.id INTO uid FROM auth.users u JOIN candidates c ON u.email='phone-'||c.mobile||'@radiantguard.local'
    WHERE c.role_key='super_admin' AND c.status IN ('active','approved') LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'Missing authorized regression user'; END IF;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
  UPDATE attendance_sheets SET status='draft',amendment_status='none'
    WHERE unit_id=f.unit_id AND period_start='2026-08-21' AND period_end='2026-09-20';
  PERFORM save_attendance_role_line(f.candidate_id,f.unit_id,f.designation_id,f.shift_hours,true,
    '2026-08-21','2026-09-20',true,null,f.designation_id,f.shift_hours,false);
  UPDATE attendance_entries SET code='',ot_hours=1 WHERE candidate_id=f.candidate_id AND entry_date='2026-09-01';
  IF NOT EXISTS(SELECT 1 FROM attendance_entries WHERE candidate_id=f.candidate_id AND unit_id=f.unit_id
    AND entry_date='2026-09-01' AND is_reliever AND ot_hours=1 AND code='') THEN
    RAISE EXCEPTION 'Transactional reliever Extra Duty did not persist'; END IF;
  PERFORM save_attendance_role_line(f.candidate_id,f.unit_id,f.designation_id,f.shift_hours,false,
    '2026-08-21','2026-09-20',true,null,f.designation_id,f.shift_hours,true);
  IF NOT EXISTS(SELECT 1 FROM attendance_role_choices WHERE candidate_id=f.candidate_id AND unit_id=f.unit_id
    AND month='2026-09-01' AND NOT is_reliever) THEN RAISE EXCEPTION 'Transactional regular selection failed'; END IF;
END $$;
ROLLBACK;