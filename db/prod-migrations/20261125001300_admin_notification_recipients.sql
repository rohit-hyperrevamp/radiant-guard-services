-- FIX (found in live re-review, 25 Nov 2026): get_admin_user_ids() returned
-- EVERY phone identity — i.e. every employee who has ever signed in — instead
-- of admins:
--     SELECT id FROM auth.users WHERE email LIKE 'phone-%@radiantguard.local'
-- logActivity → notifyAdmins() therefore sent every create/update anywhere in
-- the app ("Clients — Create", "Client Contracts — Create", "My Profile —
-- Update" …) to the whole workforce. Effects seen live:
--   * guards' Activity feed shows admin events incl. client/contract names (leak)
--   * the notifications table is huge; any query on it times out (57014)
--   * native push batches exceed the 100-recipient limit and fail
--
-- After this, recipients are only signed-in identities whose active employee
-- record has role admin or super_admin, plus the configured Super Admin phone.
--
-- RISK: LOW. Only narrows who receives admin activity notifications.
-- VERIFY:  select count(*) from public.get_admin_user_ids();   -- a handful, not thousands
-- OPTIONAL CLEANUP (separately, after verifying): old fan-out rows can be purged
--   from notifications for non-admin users by type, once the owner agrees.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u.id
  FROM auth.users u
  WHERE u.email ILIKE 'phone-%@radiantguard.local'
    AND (
      substring(u.email from 7 for 10) = '8373914073'   -- configured Super Admin
      OR EXISTS (
        SELECT 1
        FROM public.candidates c
        WHERE right(regexp_replace(coalesce(c.mobile, ''), '\D', '', 'g'), 10) = substring(u.email from 7 for 10)
          AND coalesce(c.status, '') <> 'inactive'
          AND c.role_key IN ('admin', 'super_admin')
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated;

COMMIT;

-- ROLLBACK (restores the previous, over-broad definition — not recommended):
-- CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
-- RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$ SELECT id FROM auth.users WHERE email LIKE 'phone-%@radiantguard.local' $$;
