-- User-authorized correction: only Chandrappa's eight CLI4331 duties.
-- Run with psql -1; capture before-state externally before execution.
DO $$
DECLARE v_c uuid := 'd808a1d8-528a-42e1-b927-dbdebc63fc08';
  v_u uuid := '973517f3-da97-48d6-a5d6-304851d95fbb'; v_prev text; n int;
BEGIN
  PERFORM 1 FROM candidates WHERE id=v_c AND employee_code='28654' AND full_name='Chandrappa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chandrappa identity mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM units WHERE id=v_u AND code='CLI4331') THEN RAISE EXCEPTION 'Client mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM payroll_runs WHERE unit_id=v_u AND payroll_status='processed'
    AND period_start<='2026-09-20' AND period_end>='2026-08-21') THEN RAISE EXCEPTION 'Payroll is processed'; END IF;
  IF (SELECT count(*) FROM attendance_entries WHERE candidate_id=v_c AND unit_id=v_u) <> 8
    OR EXISTS(SELECT 1 FROM attendance_entries WHERE candidate_id=v_c AND unit_id=v_u
      AND (entry_date NOT BETWEEN '2026-08-21' AND '2026-08-28' OR code<>'P' OR ot_hours<>0 OR is_reliever)) THEN
    RAISE EXCEPTION 'Attendance changed since inspection; no correction applied'; END IF;
  CREATE TEMP TABLE chand_other_before ON COMMIT DROP AS
    SELECT * FROM attendance_entries WHERE (candidate_id=v_c OR unit_id=v_u) AND NOT(candidate_id=v_c AND unit_id=v_u);
  v_prev:=coalesce(current_setting('app.skip_attendance_rules',true),'');
  PERFORM set_config('app.skip_attendance_rules','on',true);
  -- Zero UUID denotes this explicitly requested system correction, not an impersonated user.
  INSERT INTO attendance_role_choices(candidate_id,unit_id,month,is_reliever,chosen_by)
    VALUES(v_c,v_u,'2026-09-01',true,'00000000-0000-0000-0000-000000000000')
    ON CONFLICT(candidate_id,month,unit_id) DO UPDATE SET is_reliever=true,chosen_by=excluded.chosen_by,created_at=now();
  UPDATE attendance_entries SET code='',ot_hours=1,is_reliever=true,ed_from_cap=false,
    rule_applied=false,rule_orig_code=null,rule_orig_ot=null
    WHERE candidate_id=v_c AND unit_id=v_u;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>8 THEN RAISE EXCEPTION 'Expected eight duties, got %',n; END IF;
  PERFORM set_config('app.skip_attendance_rules',v_prev,true);
  IF EXISTS((SELECT * FROM chand_other_before EXCEPT SELECT * FROM attendance_entries)
    UNION ALL (SELECT * FROM attendance_entries WHERE (candidate_id=v_c OR unit_id=v_u)
      AND NOT(candidate_id=v_c AND unit_id=v_u) EXCEPT SELECT * FROM chand_other_before)) THEN
    RAISE EXCEPTION 'Unrelated attendance changed'; END IF;
END $$;