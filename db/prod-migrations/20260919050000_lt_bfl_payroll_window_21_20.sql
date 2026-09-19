-- Move all L&T Finance Holdings Limited and Bajaj Finance group contracts
-- from the 26–25 payroll window to the 21–20 payroll window.
-- Applied to production on 2026-09-19 (544 contracts updated).

BEGIN;

UPDATE client_contracts cc
SET payroll_window_id = '5e900b36-3cca-4137-a923-57bfe7910641', -- 21 to 20
    updated_at = now()
FROM units u
JOIN customers c ON c.id = u.customer_id
WHERE u.id = cc.unit_id
  AND cc.payroll_window_id = '59c7f3a7-342c-42d5-9783-9bf3b173d266' -- 26 to 25
  AND (
    c.name ILIKE '%L&T Finance%'
    OR c.name ILIKE 'Bajaj Financ%'
    OR c.name ILIKE 'Bajaj Allianz House'
    OR c.name ILIKE 'Bajaj Electricals%'
  );

COMMIT;
