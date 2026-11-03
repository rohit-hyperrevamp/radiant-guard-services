-- IDBI new CLIs follow their paired old CLI contract (row-by-row mapping from user sheet).
-- Copies rate fields of the single active resource and replaces the new resource's
-- rate revisions with exact copies of the old resource's revisions (Sep 1–16 and
-- Sep 17 onwards windows where present). Contract header, quantity, designation untouched.
CREATE TEMP TABLE idbi_map(new_code text, old_code text) ON COMMIT DROP;
INSERT INTO idbi_map VALUES
 ('CLI4764','CLI3735'),('CLI4765','CLI3734'),('CLI4766','CLI3733'),('CLI4767','CLI3732'),
 ('CLI4768','CLI3731'),('CLI4769','CLI3730'),('CLI4770','CLI3729'),('CLI4771','CLI3728'),
 ('CLI4772','CLI3727'),('CLI4774','CLI3725'),('CLI4775','CLI3724'),('CLI4776','CLI3723');

CREATE TEMP TABLE idbi_pairs ON COMMIT DROP AS
SELECT m.new_code, m.old_code, nr.id new_rid, nr.contract_id new_cid, orr.id old_rid
FROM idbi_map m
JOIN units nu ON nu.code=m.new_code JOIN client_contracts nc ON nc.unit_id=nu.id AND nc.status='active'
JOIN contract_resources nr ON nr.contract_id=nc.id
JOIN units ou ON ou.code=m.old_code JOIN client_contracts oc ON oc.unit_id=ou.id AND oc.status='active'
JOIN contract_resources orr ON orr.contract_id=oc.id AND orr.designation_id=nr.designation_id;

DO $$ BEGIN
  IF (SELECT count(*) FROM idbi_pairs) <> 12 OR (SELECT count(DISTINCT new_rid) FROM idbi_pairs) <> 12 THEN
    RAISE EXCEPTION 'Expected 12 pairs, got %', (SELECT count(*) FROM idbi_pairs);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.backup_idbi_new_follow_res_20261103 AS
SELECT r.* FROM contract_resources r WHERE r.id IN (SELECT new_rid FROM idbi_pairs);
CREATE TABLE IF NOT EXISTS public.backup_idbi_new_follow_rev_20261103 AS
SELECT v.* FROM contract_rate_revisions v WHERE v.resource_id IN (SELECT new_rid FROM idbi_pairs);

UPDATE contract_resources n SET
  components=o.components, benefits=o.benefits, deductions=o.deductions,
  employer_contributions=o.employer_contributions, gross=o.gross, shift_hours=o.shift_hours,
  payroll_day_base_id=o.payroll_day_base_id, billing_day_base_id=o.billing_day_base_id,
  round_off_final=o.round_off_final, round_off_totals=o.round_off_totals,
  ot_multiplier=o.ot_multiplier, ot_basis=o.ot_basis, ot_formula=o.ot_formula, ot_esi=o.ot_esi,
  ot_hourly_rate=o.ot_hourly_rate, ot_hourly_esic=o.ot_hourly_esic, updated_at=now()
FROM idbi_pairs p JOIN contract_resources o ON o.id=p.old_rid
WHERE n.id=p.new_rid;

DELETE FROM contract_rate_revisions WHERE resource_id IN (SELECT new_rid FROM idbi_pairs);

INSERT INTO contract_rate_revisions (contract_id, resource_id, status, effective_from, effective_to,
  gross, components, benefits, deductions, employer_contributions, payroll_day_base_id,
  billing_day_base_id, shift_hours, promoted_at, created_by, approved_by, approved_at)
SELECT p.new_cid, p.new_rid, v.status, v.effective_from, v.effective_to, v.gross, v.components,
  v.benefits, v.deductions, v.employer_contributions, v.payroll_day_base_id, v.billing_day_base_id,
  v.shift_hours, v.promoted_at, v.created_by, v.approved_by, v.approved_at
FROM idbi_pairs p JOIN contract_rate_revisions v ON v.resource_id=p.old_rid
WHERE v.status <> 'new_rate';
