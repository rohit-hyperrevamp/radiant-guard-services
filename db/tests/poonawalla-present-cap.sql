-- Production fixture and temporary 28-P save; every test write rolls back.
BEGIN;
DO $$
DECLARE c uuid:='ca02f30b-8cdf-4a70-a0d8-8ce03b62b934'; u uuid;
  p numeric; total_before numeric; total_after numeric;
BEGIN
  SELECT id INTO STRICT u FROM units WHERE code='CLI3780';
  SELECT sum(CASE WHEN ac.counts_as_present THEN ac.day_value ELSE 0 END+coalesce(a.ot_hours,0))
    INTO total_before FROM attendance_entries a LEFT JOIN attendance_codes ac ON ac.code=a.code
    WHERE a.unit_id=u AND a.candidate_id=c AND a.entry_date BETWEEN '2026-10-01' AND '2026-10-31';
  PERFORM apply_guard_attendance_rules(c,'2026-10-01','2026-10-31');
  SELECT sum(CASE WHEN ac.counts_as_present THEN ac.day_value ELSE 0 END),
    sum(CASE WHEN ac.counts_as_present THEN ac.day_value ELSE 0 END+coalesce(a.ot_hours,0))
    INTO p,total_after FROM attendance_entries a LEFT JOIN attendance_codes ac ON ac.code=a.code
    WHERE a.unit_id=u AND a.candidate_id=c AND a.entry_date BETWEEN '2026-10-01' AND '2026-10-31';
  IF p<>26 THEN RAISE EXCEPTION 'Mixed imported shifts bypass 26-day limit: %',p; END IF;
  IF abs(total_after-total_before)>0.000001 THEN RAISE EXCEPTION 'Worked duties lost'; END IF;
  -- Re-mark 28 actual dates Present; statement trigger must keep only 26 P.
  PERFORM set_config('app.attendance_rules_running','on',true);
  INSERT INTO attendance_entries(unit_id,candidate_id,entry_date,designation_id,shift_hours,is_reliever,code,ot_hours)
    SELECT u,c,'2026-10-30','aad77ba7-98d2-44cb-a0f1-b598eed740f4',8,false,'P',0
    WHERE NOT EXISTS(SELECT 1 FROM attendance_entries WHERE unit_id=u AND candidate_id=c AND entry_date='2026-10-30');
  UPDATE attendance_entries SET code='P',rule_applied=false,rule_orig_code=NULL,rule_orig_ot=NULL,ed_from_cap=false
    WHERE unit_id=u AND candidate_id=c AND entry_date BETWEEN '2026-10-01' AND '2026-10-31';
  PERFORM set_config('app.attendance_rules_running','',true);
  UPDATE attendance_entries SET code=code WHERE unit_id=u AND candidate_id=c AND entry_date='2026-10-30';
  SELECT sum(ac.day_value) INTO p FROM attendance_entries a JOIN attendance_codes ac ON ac.code=a.code AND ac.counts_as_present
    WHERE a.unit_id=u AND a.candidate_id=c AND a.entry_date BETWEEN '2026-10-01' AND '2026-10-31';
  IF p<>26 THEN RAISE EXCEPTION 'Saving 28 Present dates must leave 26 Present: %',p; END IF;
END $$;
ROLLBACK;