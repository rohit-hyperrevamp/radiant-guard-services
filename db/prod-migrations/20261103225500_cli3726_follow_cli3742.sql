-- CLI3726 follows CLI3742 incl. 1–16 Sep and 17 Sep+ dated rates.
CREATE TABLE IF NOT EXISTS public.backup_cli3726_res_20261103 AS SELECT * FROM contract_resources WHERE id='76f0fa05-ebb7-4c0d-af1d-c7f83fe945e0';
CREATE TABLE IF NOT EXISTS public.backup_cli3726_rev_20261103 AS SELECT * FROM contract_rate_revisions WHERE resource_id='76f0fa05-ebb7-4c0d-af1d-c7f83fe945e0';
-- now follow CLI3736
UPDATE contract_resources n SET components=o.components, benefits=o.benefits, deductions=o.deductions,
  employer_contributions=o.employer_contributions, gross=o.gross, shift_hours=o.shift_hours,
  payroll_day_base_id=o.payroll_day_base_id, billing_day_base_id=o.billing_day_base_id,
  round_off_final=o.round_off_final, round_off_totals=o.round_off_totals, ot_multiplier=o.ot_multiplier,
  ot_basis=o.ot_basis, ot_formula=o.ot_formula, ot_esi=o.ot_esi, ot_hourly_rate=o.ot_hourly_rate,
  ot_hourly_esic=o.ot_hourly_esic, updated_at=now()
FROM contract_resources o WHERE o.id='c7137d9b-3b57-4d45-9697-3657471f05ec' AND n.id='76f0fa05-ebb7-4c0d-af1d-c7f83fe945e0';
DELETE FROM contract_rate_revisions WHERE resource_id='76f0fa05-ebb7-4c0d-af1d-c7f83fe945e0';
INSERT INTO contract_rate_revisions (contract_id, resource_id, status, effective_from, effective_to,
  gross, components, benefits, deductions, employer_contributions, payroll_day_base_id,
  billing_day_base_id, shift_hours, promoted_at, created_by, approved_by, approved_at)
SELECT 'f5d608fd-98e4-4683-86f4-af746b43ae7b','76f0fa05-ebb7-4c0d-af1d-c7f83fe945e0', v.status, v.effective_from, v.effective_to, v.gross, v.components,
  v.benefits, v.deductions, v.employer_contributions, v.payroll_day_base_id, v.billing_day_base_id,
  v.shift_hours, v.promoted_at, v.created_by, v.approved_by, v.approved_at
FROM contract_rate_revisions v WHERE v.resource_id='c7137d9b-3b57-4d45-9697-3657471f05ec' AND v.status <> 'new_rate';
