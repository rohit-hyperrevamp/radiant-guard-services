-- SECURITY: every phone identity (phone-<10 digits>@radiantguard.local) had the
-- password "RG-<phone>-pre-launch!", so anyone with the public anon key could
-- sign in as any employee — including the Super Admin — straight against
-- Supabase Auth, bypassing the website and OTP.
--
-- The app no longer signs in with passwords: sessions are issued server-side
-- only after a verified OTP (src/lib/otp.functions.ts → mintPhoneSession).
-- This replaces every phone identity's password with a random one nobody knows.
--
-- RISK: LOW once the new app code is deployed. Apply AFTER the deploy that
-- removes signInWithPassword (otherwise the OLD app's login breaks).
-- Effect on users: none. Existing sessions keep working; next login uses OTP.
--
-- VERIFY (should return 0):
--   select count(*) from auth.users
--   where email ilike 'phone-%@radiantguard.local'
--     and encrypted_password = extensions.crypt('RG-' || substring(email from 7 for 10) || '-pre-launch!', encrypted_password);

BEGIN;

UPDATE auth.users
SET encrypted_password = extensions.crypt(
      encode(extensions.gen_random_bytes(32), 'hex'),
      extensions.gen_salt('bf')
    ),
    updated_at = now()
WHERE email ILIKE 'phone-%@radiantguard.local';

COMMIT;

-- ROLLBACK: not possible (and not wanted) — old passwords were public.
-- The app does not need them; sign-in is OTP → server-issued session.
