-- CLI3755 follows CLI3741: active resource rate fields + full rate history (1–16 Sep, 17 Sep onwards).
CREATE TABLE IF NOT EXISTS public.backup_cli3755_res_20261103 AS SELECT * FROM contract_resources WHERE id='378b86bb-7ce9-4cc7-a916-4404367f72c4';
CREATE TABLE IF NOT EXISTS public.backup_cli3755_rev_20261103 AS SELECT * FROM contract_rate_revisions WHERE resource_id='378b86bb-7ce9-4cc7-a916-4404367f72c4';
UPDATE contract_resources n SET
  components=o.components, benefits=o.benefits, deductions=o.deductions,
  employer_contributions=o.employer_contributions, gross=o.gross, shift_hours=o.shift_hours,
  payroll_day_base_id=o.payroll_day_base_id, billing_day_base_id=o.billing_day_base_id,
  round_off_final=o.round_off_final, round_off_totals=o.round_off_totals,
  ot_multiplier=o.ot_multiplier, ot_basis=o.ot_basis, ot_formula=o.ot_formula, ot_esi=o.ot_esi,
  ot_hourly_rate=o.ot_hourly_rate, ot_hourly_esic=o.ot_hourly_esic, updated_at=now()
FROM contract_resources o WHERE o.id='b1903f95-bc65-4157-ad1e-349c633066b6' AND n.id='378b86bb-7ce9-4cc7-a916-4404367f72c4';
DELETE FROM contract_rate_revisions WHERE resource_id='378b86bb-7ce9-4cc7-a916-4404367f72c4';
INSERT INTO contract_rate_revisions (contract_id, resource_id, status, effective_from, effective_to,
  gross, components, benefits, deductions, employer_contributions, payroll_day_base_id,
  billing_day_base_id, shift_hours, promoted_at, created_by, approved_by, approved_at)
SELECT 'a4e058ba-593e-4828-9066-b5372dc39dec', '378b86bb-7ce9-4cc7-a916-4404367f72c4', v.status, v.effective_from, v.effective_to, v.gross, v.components,
  v.benefits, v.deductions, v.employer_contributions, v.payroll_day_base_id, v.billing_day_base_id,
  v.shift_hours, v.promoted_at, v.created_by, v.approved_by, v.approved_at
FROM contract_rate_revisions v WHERE v.resource_id='b1903f95-bc65-4157-ad1e-349c633066b6' AND v.status <> 'new_rate';
