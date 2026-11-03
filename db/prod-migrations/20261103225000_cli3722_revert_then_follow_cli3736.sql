-- Undo CLI3722<-CLI3766 copy (restore from backup), then follow CLI3736 incl. 1–16 Sep and 17 Sep+ dated rates.
DELETE FROM contract_rate_revisions WHERE resource_id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
INSERT INTO contract_rate_revisions SELECT * FROM public.backup_cli3722_rev_20261103;
UPDATE contract_resources n SET components=b.components, benefits=b.benefits, deductions=b.deductions,
  employer_contributions=b.employer_contributions, gross=b.gross, shift_hours=b.shift_hours,
  payroll_day_base_id=b.payroll_day_base_id, billing_day_base_id=b.billing_day_base_id,
  round_off_final=b.round_off_final, round_off_totals=b.round_off_totals, ot_multiplier=b.ot_multiplier,
  ot_basis=b.ot_basis, ot_formula=b.ot_formula, ot_esi=b.ot_esi, ot_hourly_rate=b.ot_hourly_rate,
  ot_hourly_esic=b.ot_hourly_esic, updated_at=now()
FROM public.backup_cli3722_res_20261103 b WHERE n.id=b.id;
-- now follow CLI3736
UPDATE contract_resources n SET components=o.components, benefits=o.benefits, deductions=o.deductions,
  employer_contributions=o.employer_contributions, gross=o.gross, shift_hours=o.shift_hours,
  payroll_day_base_id=o.payroll_day_base_id, billing_day_base_id=o.billing_day_base_id,
  round_off_final=o.round_off_final, round_off_totals=o.round_off_totals, ot_multiplier=o.ot_multiplier,
  ot_basis=o.ot_basis, ot_formula=o.ot_formula, ot_esi=o.ot_esi, ot_hourly_rate=o.ot_hourly_rate,
  ot_hourly_esic=o.ot_hourly_esic, updated_at=now()
FROM contract_resources o WHERE o.id='4e3b8f27-1862-426b-b004-789e23a59447' AND n.id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
DELETE FROM contract_rate_revisions WHERE resource_id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
INSERT INTO contract_rate_revisions (contract_id, resource_id, status, effective_from, effective_to,
  gross, components, benefits, deductions, employer_contributions, payroll_day_base_id,
  billing_day_base_id, shift_hours, promoted_at, created_by, approved_by, approved_at)
SELECT '79ede264-b477-4b79-af67-ce13988c4691','c73bc18f-5c45-4ac1-9fdc-8edea156eff7', v.status, v.effective_from, v.effective_to, v.gross, v.components,
  v.benefits, v.deductions, v.employer_contributions, v.payroll_day_base_id, v.billing_day_base_id,
  v.shift_hours, v.promoted_at, v.created_by, v.approved_by, v.approved_at
FROM contract_rate_revisions v WHERE v.resource_id='4e3b8f27-1862-426b-b004-789e23a59447' AND v.status <> 'new_rate';
