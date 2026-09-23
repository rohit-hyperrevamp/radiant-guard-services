-- Merge six duplicate L&T Finance contracts/sites into their surviving counterparts
-- and expire the old contracts.
--
-- CON14918 (CLI3931 Bundi - Chirawa)      -> CON16000 (CLI4354)
-- CON14898 (CLI3866 Hanumangarh Town)     -> CON15978 (CLI4372)
-- CON14915 (CLI3916 Jaipur Mansarovar)    -> CON15993 (CLI4357)
-- CON14910 (CLI3910 Makrana)              -> CON15989 (CLI4361)
-- CON14907 (CLI3907 Nawalgarh)            -> CON15986 (CLI4364)
-- CON14906 (CLI3905 Tonk)                 -> CON15985 (CLI4365)

BEGIN;

CREATE TEMP TABLE pair_map (old_code text, new_code text, old_unit uuid, new_unit uuid) ON COMMIT DROP;

INSERT INTO pair_map (old_code, new_code)
VALUES ('CON14918','CON16000'),
       ('CON14898','CON15978'),
       ('CON14915','CON15993'),
       ('CON14910','CON15989'),
       ('CON14907','CON15986'),
       ('CON14906','CON15985');

UPDATE pair_map p
SET old_unit = o.unit_id, new_unit = n.unit_id
FROM client_contracts o, client_contracts n
WHERE o.contract_code = p.old_code AND n.contract_code = p.new_code;

DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM pair_map WHERE old_unit IS NULL OR new_unit IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'pair_map incomplete: % rows unresolved', missing;
  END IF;
END $$;

-- 1. Postings: drop any duplicate posting already on the surviving site, then move.
DELETE FROM candidate_units t
USING pair_map p, candidate_units s
WHERE t.unit_id = p.new_unit
  AND s.unit_id = p.old_unit
  AND s.candidate_id = t.candidate_id;

UPDATE candidate_units s
SET unit_id = p.new_unit
FROM pair_map p
WHERE s.unit_id = p.old_unit;

-- 2. Home unit on the employee record.
UPDATE candidates c
SET unit_id = p.new_unit
FROM pair_map p
WHERE c.unit_id = p.old_unit;

-- 3. Attendance sheets (skip periods already present on the surviving site).
UPDATE attendance_sheets s
SET unit_id = p.new_unit
FROM pair_map p
WHERE s.unit_id = p.old_unit
  AND NOT EXISTS (
    SELECT 1 FROM attendance_sheets t
    WHERE t.unit_id = p.new_unit
      AND t.period_start = s.period_start
      AND t.period_end = s.period_end);

UPDATE attendance_sheet_versions v
SET unit_id = p.new_unit
FROM pair_map p
WHERE v.unit_id = p.old_unit;

-- 4. Attendance entries. Historic reliever rows carry present codes, so the
-- reliever/present-day guards are suspended while rows are relocated unchanged.
ALTER TABLE attendance_entries DISABLE TRIGGER attendance_entries_reliever_ed_only;
ALTER TABLE attendance_entries DISABLE TRIGGER enforce_contract_present_day_limit_trigger;

UPDATE attendance_entries e
SET unit_id = p.new_unit
FROM pair_map p
WHERE e.unit_id = p.old_unit
  AND NOT EXISTS (
    SELECT 1 FROM attendance_entries t
    WHERE t.unit_id = p.new_unit
      AND t.candidate_id = e.candidate_id
      AND t.entry_date = e.entry_date
      AND t.designation_id IS NOT DISTINCT FROM e.designation_id);

ALTER TABLE attendance_entries ENABLE TRIGGER attendance_entries_reliever_ed_only;
ALTER TABLE attendance_entries ENABLE TRIGGER enforce_contract_present_day_limit_trigger;

-- 5. Payroll runs (skip windows already present on the surviving site).
UPDATE payroll_runs r
SET unit_id = p.new_unit
FROM pair_map p
WHERE r.unit_id = p.old_unit
  AND NOT EXISTS (
    SELECT 1 FROM payroll_runs t
    WHERE t.unit_id = p.new_unit
      AND t.period_start = r.period_start
      AND t.period_end = r.period_end);

UPDATE payroll_run_snapshots s
SET unit_id = p.new_unit
FROM pair_map p
WHERE s.unit_id = p.old_unit;

-- 6. Scan jobs and self punches.
UPDATE attendance_scan_jobs j
SET unit_id = p.new_unit
FROM pair_map p
WHERE j.unit_id = p.old_unit;

UPDATE self_attendance_punches sp
SET unit_id = p.new_unit
FROM pair_map p
WHERE sp.unit_id = p.old_unit;

-- 7. Expire the duplicate contracts.
UPDATE client_contracts cc
SET status = 'expired',
    end_date = LEAST(COALESCE(cc.end_date, DATE '2026-09-23'), DATE '2026-09-23'),
    expiry_date = DATE '2026-09-23',
    updated_at = now()
FROM pair_map p
WHERE cc.contract_code = p.old_code;

-- 8. Close out the duplicate sites.
UPDATE units u
SET status = 'inactive',
    closing_date = COALESCE(u.closing_date, DATE '2026-09-23'),
    updated_at = now()
FROM pair_map p
WHERE u.id = p.old_unit;

COMMIT;
