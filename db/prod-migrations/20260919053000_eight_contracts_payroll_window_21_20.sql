-- Move 8 client contracts from the 26–25 payroll window to the 21–20 window,
-- per the client's confirmed list of 21–20 client IDs.
-- Applied to production on 2026-09-19 (8 contracts updated).

BEGIN;

UPDATE client_contracts cc
SET payroll_window_id = '5e900b36-3cca-4137-a923-57bfe7910641', -- 21 to 20
    updated_at = now()
FROM units u
WHERE u.id = cc.unit_id
  AND u.code IN ('CLI2738','CLI2739','CLI2740','CLI2741','CLI2742','CLI3885','CLI4255','CLI4452')
  AND cc.payroll_window_id = '59c7f3a7-342c-42d5-9783-9bf3b173d266'; -- 26 to 25

COMMIT;
