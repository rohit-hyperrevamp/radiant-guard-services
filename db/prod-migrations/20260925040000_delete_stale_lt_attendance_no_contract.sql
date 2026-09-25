-- Remove attendance left behind at L&T sites whose only contract (1–31 window)
-- was deleted on 2026-09-25. Only CLI3908 (Bhiwadi) had such data: 31 entries,
-- 1–31 Aug 2026. 21–20 window data untouched. Non-billable Radiant home office
-- (UN1) intentionally kept — it is the Field Officer payroll base, not a client.
BEGIN;
DELETE FROM attendance_sheet_versions v USING units u WHERE u.id=v.unit_id AND u.code='CLI3908'
  AND NOT EXISTS (SELECT 1 FROM client_contracts cc WHERE cc.unit_id=u.id);
DELETE FROM self_attendance_punches p USING units u WHERE u.id=p.unit_id AND u.code='CLI3908'
  AND NOT EXISTS (SELECT 1 FROM client_contracts cc WHERE cc.unit_id=u.id);
DELETE FROM attendance_entries e USING units u WHERE u.id=e.unit_id AND u.code='CLI3908'
  AND NOT EXISTS (SELECT 1 FROM client_contracts cc WHERE cc.unit_id=u.id);
COMMIT;
