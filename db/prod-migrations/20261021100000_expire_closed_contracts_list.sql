-- Expire the 51 closed client contracts from Cloosed_contrect_1.xlsx and close their sites (2026-10-21).
-- UN1 (Radiant Corporate Office) intentionally excluded: no contract, FO home base.
BEGIN;
CREATE TABLE IF NOT EXISTS backup_closed_contracts_20261021 AS
  SELECT now() AS backed_up_at, cc.* FROM client_contracts cc WHERE false;
CREATE TABLE IF NOT EXISTS backup_closed_units_20261021 AS
  SELECT now() AS backed_up_at, u.* FROM units u WHERE false;

WITH inp(contract_code) AS (VALUES ('CON16131'),('CON14869'),('CON14282'),('CON14315'),('CON16343'),('CON16345'),('CON15117'),('CON16344'),('CON15116'),('CON10955'),('CON14292'),('CON14660'),('CON14658'),('CON14860'),('CON14631'),('CON14879'),('CON14870'),('CON14857'),('CON14642'),('CON14641'),('CON14648'),('CON15183'),('CON14880'),('CON14659'),('CON14652'),('CON14651'),('CON14657'),('CON14656'),('CON14653'),('CON14655'),('CON14661'),('CON14654'),('CON14889'),('CON14886'),('CON14888'),('CON14638'),('CON14221'),('CON14127'),('CON1511'),('CON14283'),('CON12879'),('CON14152'),('CON12704'),('CON15855'),('CON15858'),('CON15857'),('CON15856'),('CON13957'),('CON14027'),('CON7635'),('CON5262'))
INSERT INTO backup_closed_contracts_20261021 SELECT now(), cc.* FROM client_contracts cc
JOIN inp i ON i.contract_code = cc.contract_code;

WITH inp(contract_code) AS (VALUES ('CON16131'),('CON14869'),('CON14282'),('CON14315'),('CON16343'),('CON16345'),('CON15117'),('CON16344'),('CON15116'),('CON10955'),('CON14292'),('CON14660'),('CON14658'),('CON14860'),('CON14631'),('CON14879'),('CON14870'),('CON14857'),('CON14642'),('CON14641'),('CON14648'),('CON15183'),('CON14880'),('CON14659'),('CON14652'),('CON14651'),('CON14657'),('CON14656'),('CON14653'),('CON14655'),('CON14661'),('CON14654'),('CON14889'),('CON14886'),('CON14888'),('CON14638'),('CON14221'),('CON14127'),('CON1511'),('CON14283'),('CON12879'),('CON14152'),('CON12704'),('CON15855'),('CON15858'),('CON15857'),('CON15856'),('CON13957'),('CON14027'),('CON7635'),('CON5262'))
INSERT INTO backup_closed_units_20261021 SELECT now(), u.* FROM units u
JOIN client_contracts cc ON cc.unit_id = u.id JOIN inp i ON i.contract_code = cc.contract_code;

WITH inp(contract_code) AS (VALUES ('CON16131'),('CON14869'),('CON14282'),('CON14315'),('CON16343'),('CON16345'),('CON15117'),('CON16344'),('CON15116'),('CON10955'),('CON14292'),('CON14660'),('CON14658'),('CON14860'),('CON14631'),('CON14879'),('CON14870'),('CON14857'),('CON14642'),('CON14641'),('CON14648'),('CON15183'),('CON14880'),('CON14659'),('CON14652'),('CON14651'),('CON14657'),('CON14656'),('CON14653'),('CON14655'),('CON14661'),('CON14654'),('CON14889'),('CON14886'),('CON14888'),('CON14638'),('CON14221'),('CON14127'),('CON1511'),('CON14283'),('CON12879'),('CON14152'),('CON12704'),('CON15855'),('CON15858'),('CON15857'),('CON15856'),('CON13957'),('CON14027'),('CON7635'),('CON5262'))
UPDATE client_contracts cc
SET status = 'expired',
    end_date = LEAST(COALESCE(cc.end_date, DATE '2026-09-30'), DATE '2026-09-30'),
    expiry_date = DATE '2026-09-30',
    updated_at = now()
FROM inp i WHERE cc.contract_code = i.contract_code AND cc.status IS DISTINCT FROM 'expired';

WITH inp(contract_code) AS (VALUES ('CON16131'),('CON14869'),('CON14282'),('CON14315'),('CON16343'),('CON16345'),('CON15117'),('CON16344'),('CON15116'),('CON10955'),('CON14292'),('CON14660'),('CON14658'),('CON14860'),('CON14631'),('CON14879'),('CON14870'),('CON14857'),('CON14642'),('CON14641'),('CON14648'),('CON15183'),('CON14880'),('CON14659'),('CON14652'),('CON14651'),('CON14657'),('CON14656'),('CON14653'),('CON14655'),('CON14661'),('CON14654'),('CON14889'),('CON14886'),('CON14888'),('CON14638'),('CON14221'),('CON14127'),('CON1511'),('CON14283'),('CON12879'),('CON14152'),('CON12704'),('CON15855'),('CON15858'),('CON15857'),('CON15856'),('CON13957'),('CON14027'),('CON7635'),('CON5262'))
UPDATE units u
SET status = 'inactive',
    closing_date = COALESCE(u.closing_date, DATE '2026-09-30'),
    updated_at = now()
FROM client_contracts cc JOIN inp i ON i.contract_code = cc.contract_code
WHERE u.id = cc.unit_id AND u.status IS DISTINCT FROM 'inactive';
COMMIT;
