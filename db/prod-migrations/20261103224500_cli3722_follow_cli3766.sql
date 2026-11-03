-- CLI3722 Security Guard follows CLI3766 Security Guard. CLI3766 has no dated rates,
-- so its single rate is used for both 1–16 Sep and 17 Sep 2026 – 31 Mar 2027.
CREATE TABLE IF NOT EXISTS public.backup_cli3722_res_20261103 AS SELECT * FROM contract_resources WHERE id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
CREATE TABLE IF NOT EXISTS public.backup_cli3722_rev_20261103 AS SELECT * FROM contract_rate_revisions WHERE resource_id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
UPDATE contract_resources n SET
  components=o.components, benefits=o.benefits, deductions=o.deductions,
  employer_contributions=o.employer_contributions, gross=o.gross, shift_hours=o.shift_hours,
  payroll_day_base_id=o.payroll_day_base_id, billing_day_base_id=o.billing_day_base_id,
  round_off_final=o.round_off_final, round_off_totals=o.round_off_totals,
  ot_multiplier=o.ot_multiplier, ot_basis=o.ot_basis, ot_formula=o.ot_formula, ot_esi=o.ot_esi,
  ot_hourly_rate=o.ot_hourly_rate, ot_hourly_esic=o.ot_hourly_esic, updated_at=now()
FROM contract_resources o WHERE o.id='a31b07e9-dad8-4856-9fa4-e59188dc4078' AND n.id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
DELETE FROM contract_rate_revisions WHERE resource_id='c73bc18f-5c45-4ac1-9fdc-8edea156eff7';
INSERT INTO contract_rate_revisions (contract_id, resource_id, status, effective_from, effective_to,
  gross, components, benefits, deductions, employer_contributions, payroll_day_base_id,
  billing_day_base_id, shift_hours, approved_at)
SELECT '79ede264-b477-4b79-af67-ce13988c4691','c73bc18f-5c45-4ac1-9fdc-8edea156eff7','approved', w.f, w.t,
  o.gross,o.components,o.benefits,o.deductions,o.employer_contributions,o.payroll_day_base_id,o.billing_day_base_id,o.shift_hours,now()
FROM contract_resources o, (VALUES ('2026-09-01'::date,'2026-09-16'::date),('2026-09-17'::date,'2027-03-31'::date)) w(f,t)
WHERE o.id='a31b07e9-dad8-4856-9fa4-e59188dc4078';
