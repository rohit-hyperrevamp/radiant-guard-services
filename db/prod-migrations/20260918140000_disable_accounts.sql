-- Disable employee accounts (sign-in blocked).
-- Sign-in eligibility is decided by public.can_phone_login(), which requires
-- candidates.status IN ('active','approved') AND is_enabled = true.
-- This mirrors the Employees page enable/disable toggle (is_enabled=false + status='inactive').

-- Requested this turn: Maj Lalit Kaushal (49269), Rajendra Chikane (49270),
-- Ravindra Shamrao Bhosle (42556).
UPDATE public.candidates
SET is_enabled = false,
    status = 'inactive'
WHERE employee_code IN ('49269', '49270', '42556');

-- Correction for 49268 (Bonnie D'monte) and 21153 (Ganesh Devendra Vispute),
-- requested as "disable" in an earlier turn: the disability flag (is_disabled,
-- a PwD payroll attribute that raises the ESI wage ceiling) was set instead of
-- disabling the account, so their logins were never blocked. Revert that flag
-- and disable them the same way as above.
UPDATE public.candidates
SET is_disabled = false
WHERE employee_code IN ('49268', '21153')
  AND is_disabled = true;

UPDATE public.candidates
SET is_enabled = false,
    status = 'inactive'
WHERE employee_code IN ('49268', '21153');
