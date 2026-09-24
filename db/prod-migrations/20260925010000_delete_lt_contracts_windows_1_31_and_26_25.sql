-- Delete all L&T Finance contracts sitting in the 1–31 (9676d05d…) and
-- 26–25 (59c7f3a7…) payroll windows, per client instruction.
-- Applied to production on 2026-09-25: 35 contracts deleted (all in 1–31;
-- none existed in 26–25). Their contract_resources rows were removed first.

BEGIN;

CREATE TEMP TABLE del_lt AS
SELECT cc.id FROM client_contracts cc
JOIN units u ON u.id = cc.unit_id
JOIN customers c ON c.id = u.customer_id
WHERE c.name ILIKE '%L&T%'
  AND cc.payroll_window_id IN ('9676d05d-fbb3-4d9a-bdca-b4b9ac65db0c','59c7f3a7-342c-42d5-9783-9bf3b173d266');

DELETE FROM contract_resources WHERE contract_id IN (SELECT id FROM del_lt);
DELETE FROM client_contracts WHERE id IN (SELECT id FROM del_lt);

COMMIT;
