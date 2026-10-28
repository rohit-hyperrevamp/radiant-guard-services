-- Run against production with psql -v ON_ERROR_STOP=1; all checks roll back.
BEGIN;
DO $$
DECLARE c uuid; secondary uuid; primary_site uuid;
BEGIN
  SELECT id INTO c FROM candidates WHERE employee_code='44806';
  SELECT id INTO secondary FROM units WHERE code='CLI2252';
  SELECT id INTO primary_site FROM units WHERE code='CLI2394';
  IF c IS NULL OR secondary IS NULL OR primary_site IS NULL THEN
    RAISE EXCEPTION 'Missing employee 44806 / CLI2252 / CLI2394 fixture';
  END IF;
  -- Exercise a real Present save on the lower-attendance site's existing cell.
  UPDATE attendance_entries SET code='P', ot_hours=0
    WHERE candidate_id=c AND unit_id=secondary AND entry_date='2026-09-29';
  IF (SELECT count(*) FROM attendance_entries WHERE candidate_id=c AND unit_id=secondary
      AND entry_date BETWEEN '2026-09-21' AND '2026-10-20' AND is_reliever
      AND code='' AND ot_hours=1) <> 4 THEN
    RAISE EXCEPTION 'CLI2252 must have exactly four reliever Extra Duty days';
  END IF;
  IF EXISTS (SELECT 1 FROM attendance_entries WHERE candidate_id=c AND unit_id=secondary
      AND entry_date BETWEEN '2026-09-21' AND '2026-10-20' AND NOT is_reliever) THEN
    RAISE EXCEPTION 'Non-primary CLI2252 still has a regular attendance line';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM candidate_units WHERE candidate_id=c AND unit_id=secondary
      AND is_reliever AND NOT is_primary) THEN
    RAISE EXCEPTION 'CLI2252 posting not reliever';
  END IF;
  -- Primary site's 26-day cap must not make its two excess days reliever.
  IF (SELECT count(*) FROM attendance_entries WHERE candidate_id=c AND unit_id=primary_site
      AND entry_date BETWEEN '2026-09-21' AND '2026-10-20' AND code='P' AND NOT is_reliever) <> 26
     OR (SELECT count(*) FROM attendance_entries WHERE candidate_id=c AND unit_id=primary_site
      AND entry_date BETWEEN '2026-09-21' AND '2026-10-20' AND ed_from_cap AND NOT is_reliever) <> 2 THEN
    RAISE EXCEPTION 'CLI2394 must remain regular with 26 Present and two capped Extra Duty days';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM candidate_units WHERE candidate_id=c AND unit_id=primary_site
      AND is_primary AND NOT is_reliever) THEN RAISE EXCEPTION 'Winning posting not primary/regular'; END IF;
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE c uuid; secondary uuid; primary_site uuid;
BEGIN
  SELECT id INTO c FROM candidates WHERE employee_code='44806';
  SELECT id INTO secondary FROM units WHERE code='CLI2252';
  SELECT id INTO primary_site FROM units WHERE code='CLI2394';
  IF c IS NULL OR secondary IS NULL OR primary_site IS NULL THEN RAISE EXCEPTION 'Missing switching fixture'; END IF;
  PERFORM apply_guard_attendance_rules(c,'2026-09-21','2026-10-20');
  -- Changing the majority must promote the old reliever and restore its P marks.
  UPDATE attendance_entries SET code='A',ot_hours=0,ed_from_cap=false
    WHERE candidate_id=c AND unit_id=primary_site
      AND entry_date BETWEEN '2026-09-21' AND '2026-10-20';
  PERFORM apply_guard_attendance_rules(c,'2026-09-21','2026-10-20');
  PERFORM apply_guard_attendance_rules(c,'2026-09-21','2026-10-20');
  IF (SELECT count(*) FROM attendance_entries WHERE candidate_id=c AND unit_id=secondary
      AND entry_date BETWEEN '2026-09-21' AND '2026-10-20' AND code='P'
      AND ot_hours=0 AND NOT is_reliever) <> 4 THEN
    RAISE EXCEPTION 'New majority CLI2252 must become regular with four Present days';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM candidate_units WHERE candidate_id=c AND unit_id=secondary
      AND is_primary AND NOT is_reliever) OR NOT EXISTS
     (SELECT 1 FROM candidate_units WHERE candidate_id=c AND unit_id=primary_site AND is_reliever AND NOT is_primary) THEN
    RAISE EXCEPTION 'Site postings failed to switch with majority attendance';
  END IF;
END $$;
ROLLBACK;