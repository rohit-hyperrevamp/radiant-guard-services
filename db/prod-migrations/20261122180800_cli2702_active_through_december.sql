-- Explicit user request: reactivate CLI2702 through 31 December 2026.
-- Keep historical/inactive contract versions and every saved rate unchanged.
BEGIN;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE cli2702_unit_before ON COMMIT DROP AS
 SELECT * FROM units WHERE code='CLI2702';
CREATE TEMP TABLE cli2702_contract_before ON COMMIT DROP AS
 SELECT cc.* FROM client_contracts cc JOIN units u ON u.id=cc.unit_id
 WHERE u.code='CLI2702';
CREATE TEMP TABLE cli2702_rates_before ON COMMIT DROP AS
 SELECT cr.* FROM contract_resources cr JOIN cli2702_contract_before cc ON cc.id=cr.contract_id;
DO $$ BEGIN
 IF (SELECT count(*) FROM cli2702_unit_before)<>1 THEN
   RAISE EXCEPTION 'CLI2702 must uniquely identify one client'; END IF;
 IF (SELECT count(*) FROM cli2702_contract_before WHERE status='active')<>1 THEN
   RAISE EXCEPTION 'CLI2702 must have exactly one active contract'; END IF;
END $$;
UPDATE units SET status='active',contract_end_date=DATE '2026-12-31' WHERE code='CLI2702';
UPDATE client_contracts SET end_date=DATE '2026-12-31'
 WHERE id IN (SELECT id FROM cli2702_contract_before WHERE status='active');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM cli2702_unit_before b JOIN units u ON u.id=b.id
   WHERE u.status<>'active' OR u.contract_end_date IS DISTINCT FROM DATE '2026-12-31'
   OR (to_jsonb(u)-'status'-'contract_end_date'-'updated_at')
    IS DISTINCT FROM (to_jsonb(b)-'status'-'contract_end_date'-'updated_at'))
 THEN RAISE EXCEPTION 'Unexpected client field change'; END IF;
 IF EXISTS (SELECT 1 FROM cli2702_contract_before b JOIN client_contracts cc ON cc.id=b.id
   WHERE CASE WHEN b.status='active' THEN
    cc.end_date IS DISTINCT FROM DATE '2026-12-31' OR
    (to_jsonb(cc)-'end_date'-'updated_at') IS DISTINCT FROM (to_jsonb(b)-'end_date'-'updated_at')
    ELSE to_jsonb(cc) IS DISTINCT FROM to_jsonb(b) END)
 THEN RAISE EXCEPTION 'Unexpected historical contract change'; END IF;
 IF EXISTS (SELECT 1 FROM cli2702_rates_before b LEFT JOIN contract_resources cr ON cr.id=b.id
   WHERE to_jsonb(cr) IS DISTINCT FROM to_jsonb(b))
 THEN RAISE EXCEPTION 'A saved contract rate changed'; END IF;
END $$;
COMMIT;