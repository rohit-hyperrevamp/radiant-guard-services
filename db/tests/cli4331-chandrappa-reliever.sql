-- Concrete readback plus recalculation check; all recalculation effects roll back.
BEGIN;
DO $$
DECLARE c uuid:='d808a1d8-528a-42e1-b927-dbdebc63fc08'; u uuid:='973517f3-da97-48d6-a5d6-304851d95fbb';
BEGIN
  IF (SELECT count(*) FROM attendance_entries WHERE candidate_id=c AND unit_id=u AND is_reliever AND code='' AND ot_hours=1)<>8
    OR (SELECT sum(ot_hours) FROM attendance_entries WHERE candidate_id=c AND unit_id=u)<>8 THEN
    RAISE EXCEPTION 'Chandrappa must have exactly eight Extra Duty days and no regular duties'; END IF;
  IF NOT EXISTS(SELECT 1 FROM attendance_role_choices WHERE candidate_id=c AND unit_id=u AND month='2026-09-01' AND is_reliever)
    THEN RAISE EXCEPTION 'September reliever selection not saved'; END IF;
  PERFORM apply_guard_attendance_rules(c,'2026-08-21','2026-09-20');
  PERFORM apply_guard_attendance_rules(c,'2026-08-21','2026-09-20');
  IF (SELECT count(*) FROM attendance_entries WHERE candidate_id=c AND unit_id=u AND is_reliever AND code='' AND ot_hours=1)<>8
    THEN RAISE EXCEPTION 'Recalculation undid Chandrappa reliever selection'; END IF;
END $$;
ROLLBACK;