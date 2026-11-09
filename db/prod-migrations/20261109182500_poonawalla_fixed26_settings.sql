-- Current Poonawalla contracts only; historical contracts/rates remain intact.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='240s';
\ir 20261109182000_attendance_cap_imported_shift.sql
CREATE TEMP TABLE pf_units AS SELECT u.id FROM units u JOIN customers c ON c.id=u.customer_id
  WHERE c.id IN ('b91988b4-b5b2-4931-b814-f440c1605ffa','6573470e-6780-4b67-81dc-35906644ab1a',
    '58ac6540-7bda-4b79-8b2c-8fdea68581db','755d96f8-c1cb-49f0-baf6-63e05f0a4295','786f0e76-0e85-4ef4-a4ca-6d282814c1db');
CREATE TEMP TABLE pf_resources_before AS SELECT cr.* FROM contract_resources cr
  JOIN client_contracts cc ON cc.id=cr.contract_id JOIN pf_units u ON u.id=cc.unit_id WHERE cc.status='active';
CREATE TEMP TABLE pf_preserve AS SELECT
  (SELECT jsonb_agg(to_jsonb(u) ORDER BY u.id) FROM units u) units,
  (SELECT jsonb_agg(to_jsonb(cc) ORDER BY cc.id) FROM client_contracts cc JOIN pf_units u ON u.id=cc.unit_id) contracts,
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM attendance_entries a WHERE EXISTS
    (SELECT 1 FROM payroll_runs p WHERE p.unit_id=a.unit_id AND a.entry_date BETWEEN p.period_start AND p.period_end AND p.payroll_status='processed')) locked_attendance;
-- Keep billing's previously inherited divisor explicit before changing payroll.
UPDATE contract_resources cr SET payroll_day_base_id='fe52c7ac-4cfd-4de2-924f-56c69dfb2d96',
  billing_day_base_id=coalesce(cr.billing_day_base_id,cr.payroll_day_base_id)
  FROM pf_resources_before b WHERE b.id=cr.id AND cr.payroll_day_base_id IS DISTINCT FROM 'fe52c7ac-4cfd-4de2-924f-56c69dfb2d96'::uuid;
-- Already-Fixed-26 site with imported split shift keys also needs recalculation.
SELECT apply_guard_attendance_rules('ca02f30b-8cdf-4a70-a0d8-8ce03b62b934','2026-10-01','2026-10-31');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pf_resources_before b JOIN contract_resources cr ON cr.id=b.id
    WHERE (to_jsonb(cr)-ARRAY['payroll_day_base_id','billing_day_base_id','updated_at']) IS DISTINCT FROM
      (to_jsonb(b)-ARRAY['payroll_day_base_id','billing_day_base_id','updated_at'])
      OR coalesce(cr.billing_day_base_id,cr.payroll_day_base_id) IS DISTINCT FROM coalesce(b.billing_day_base_id,b.payroll_day_base_id))
    THEN RAISE EXCEPTION 'Rate or billing divisor changed'; END IF;
  IF (SELECT units FROM pf_preserve) IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(u) ORDER BY u.id) FROM units u)
    THEN RAISE EXCEPTION 'Client details changed'; END IF;
  IF (SELECT contracts FROM pf_preserve) IS DISTINCT FROM
    (SELECT jsonb_agg(to_jsonb(cc) ORDER BY cc.id) FROM client_contracts cc JOIN pf_units u ON u.id=cc.unit_id)
    THEN RAISE EXCEPTION 'Contract terms changed'; END IF;
  IF (SELECT locked_attendance FROM pf_preserve) IS DISTINCT FROM
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM attendance_entries a WHERE EXISTS
      (SELECT 1 FROM payroll_runs p WHERE p.unit_id=a.unit_id AND a.entry_date BETWEEN p.period_start AND p.period_end AND p.payroll_status='processed'))
    THEN RAISE EXCEPTION 'Processed attendance changed'; END IF;
END $$;
COMMIT;