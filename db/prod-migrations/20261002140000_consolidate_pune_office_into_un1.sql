-- Consolidate Pune office staff from CLI4 / CLI4155 onto UN1 (Corporate Office Pune - HO)
-- and retire both duplicate Radiant Pune client sites.
BEGIN;

CREATE TEMP TABLE pair_map (old_unit uuid, new_unit uuid) ON COMMIT DROP;
INSERT INTO pair_map VALUES
  ('3248c96e-a242-4eb8-ba5d-f657376679a1','0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'),
  ('49372cb1-2aac-4675-87d2-44474e5ce3cc','0889cfb4-7fd6-44b4-bbac-7d7026e33f0f');

-- Mappings: drop duplicates already on UN1, then move.
DELETE FROM candidate_units s USING pair_map p, candidate_units t
 WHERE s.unit_id = p.old_unit AND t.unit_id = p.new_unit AND t.candidate_id = s.candidate_id;
UPDATE candidate_units s SET unit_id = p.new_unit FROM pair_map p WHERE s.unit_id = p.old_unit;

-- Home unit.
UPDATE candidates c SET unit_id = p.new_unit FROM pair_map p WHERE c.unit_id = p.old_unit;

-- Field Officers always have UN1 as payroll home.
UPDATE candidates SET unit_id = '0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'
 WHERE role_key = 'field_officer' AND status IN ('active','approved')
   AND (unit_id IS NULL OR unit_id NOT IN (SELECT id FROM units));

-- Scope rows pointing at old sites.
DELETE FROM employee_scope_assignments s USING pair_map p, employee_scope_assignments t
 WHERE s.scope_type='unit' AND s.scope_id = p.old_unit::text
   AND t.scope_type='unit' AND t.scope_id = p.new_unit::text AND t.candidate_id = s.candidate_id;
UPDATE employee_scope_assignments s SET scope_id = p.new_unit::text,
       scope_label = 'UN1 - Corporate Office (Pune - HO)'
  FROM pair_map p WHERE s.scope_type='unit' AND s.scope_id = p.old_unit::text;

-- Attendance.
UPDATE attendance_sheets s SET unit_id = p.new_unit FROM pair_map p
 WHERE s.unit_id = p.old_unit AND NOT EXISTS (SELECT 1 FROM attendance_sheets t
   WHERE t.unit_id = p.new_unit AND t.period_start = s.period_start AND t.period_end = s.period_end);
UPDATE attendance_sheet_versions v SET unit_id = p.new_unit FROM pair_map p WHERE v.unit_id = p.old_unit;

ALTER TABLE attendance_entries DISABLE TRIGGER attendance_entries_reliever_ed_only;
ALTER TABLE attendance_entries DISABLE TRIGGER enforce_contract_present_day_limit_trigger;
UPDATE attendance_entries e SET unit_id = p.new_unit FROM pair_map p
 WHERE e.unit_id = p.old_unit AND NOT EXISTS (SELECT 1 FROM attendance_entries t
   WHERE t.unit_id = p.new_unit AND t.candidate_id = e.candidate_id AND t.entry_date = e.entry_date
     AND t.designation_id IS NOT DISTINCT FROM e.designation_id);
ALTER TABLE attendance_entries ENABLE TRIGGER attendance_entries_reliever_ed_only;
ALTER TABLE attendance_entries ENABLE TRIGGER enforce_contract_present_day_limit_trigger;

UPDATE self_attendance_punches sp SET unit_id = p.new_unit FROM pair_map p WHERE sp.unit_id = p.old_unit;
UPDATE attendance_scan_jobs j SET unit_id = p.new_unit FROM pair_map p WHERE j.unit_id = p.old_unit;

-- Payroll.
UPDATE payroll_runs r SET unit_id = p.new_unit FROM pair_map p
 WHERE r.unit_id = p.old_unit AND NOT EXISTS (SELECT 1 FROM payroll_runs t
   WHERE t.unit_id = p.new_unit AND t.period_start = r.period_start AND t.period_end = r.period_end);
UPDATE payroll_run_snapshots s SET unit_id = p.new_unit FROM pair_map p WHERE s.unit_id = p.old_unit;

-- Retire the duplicate sites.
UPDATE units u SET status = 'inactive', closing_date = COALESCE(u.closing_date, DATE '2026-10-02'), updated_at = now()
  FROM pair_map p WHERE u.id = p.old_unit;

COMMIT;
