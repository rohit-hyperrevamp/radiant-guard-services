-- Expire the active contracts of the 12 old IDBI CLIs on 31 Aug 2026 (replaced by new CLIs).
BEGIN;
CREATE TABLE public.backup_idbi_old_contracts_20261103 AS
SELECT c.* FROM client_contracts c JOIN units u ON u.id=c.unit_id
WHERE u.code IN ('CLI3735','CLI3734','CLI3733','CLI3732','CLI3731','CLI3730','CLI3729','CLI3728','CLI3727','CLI3725','CLI3724','CLI3723')
  AND c.status='active';
DO $$ BEGIN IF (SELECT count(*) FROM backup_idbi_old_contracts_20261103)<>12 THEN RAISE EXCEPTION 'expected 12'; END IF; END $$;
UPDATE client_contracts c SET status='expired', end_date='2026-08-31', expiry_date='2026-08-31'
WHERE c.id IN (SELECT id FROM backup_idbi_old_contracts_20261103);
COMMIT;
