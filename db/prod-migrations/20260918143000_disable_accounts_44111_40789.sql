-- Disable employee accounts (sign-in blocked).
-- Sign-in eligibility is decided by public.can_phone_login(), which requires
-- candidates.status IN ('active','approved') AND is_enabled = true.
-- This mirrors the Employees page enable/disable toggle (is_enabled=false + status='inactive').

-- Requested: Vinod Kumar (44111), Patil Kailas Ekanath (40789).
UPDATE public.candidates
SET is_enabled = false,
    status = 'inactive'
WHERE employee_code IN ('44111', '40789');
