-- 20261125000600_notifications_insert_guard.sql
-- RISK: LOW - apply now (partial fix; see "NOT CLOSED").
--
-- CLOSES (partly): S11 push/notification spoofing.
--   Prior policy "Authenticated insert notifications":
--     WITH CHECK (actor_id IS NULL OR actor_id = auth.uid())
--   lets anyone insert an anonymous (actor_id NULL) notification for ANY user, and
--   lets disabled / ex-employees keep sending.
--   New policy rf_notifications_insert:
--     actor_id = auth.uid()                     -- sender is always recorded, never blank/forged
--     AND ( user_id = auth.uid()                -- note to self
--           OR is_admin_user()
--           OR is_current_employee_active() )   -- active staff may notify colleagues
--
-- WHY NOT "user_id = auth.uid() only": the browser legitimately notifies OTHER
--   users today - src/lib/notifications.ts (createNotification, notifyAdmins,
--   notifyApprovers, notifyOnboardingApprovers) and src/lib/workflows.ts
--   (notifyRole, notifyUserIds) insert rows for approvers/admins with
--   actor_id = current user. Restricting to self would silently break every
--   approval / onboarding / rehire / inventory notification. All those call sites
--   already set actor_id to the signed-in user, so they keep working.
--   Server code (daily-people-pings, task reminders, case hearings) uses
--   service_role / SECURITY DEFINER and bypasses RLS.
--
-- NOT CLOSED (needs app change, listed in README): an active employee can still
--   send arbitrary title/text to any user (but now always under their own name).
--   Full fix = move cross-user notifications into a SECURITY DEFINER RPC that
--   derives recipients from the workflow/entity, and have push.functions.ts only
--   deliver pushes for notification ids whose actor_id = caller.
--
-- AFFECTED SCREENS / ROLES: any flow that raises a notification; only rows with
--   actor_id NULL or sent by an inactive account are now refused.
--
-- VERIFY AFTER APPLYING:
--   SELECT policyname, with_check FROM pg_policies WHERE tablename='notifications' AND cmd='INSERT';
--   As a normal user (SQL: set role authenticated + request.jwt.claims) or from the browser console:
--     insert {user_id:<other>, actor_id:null, ...}  -> 42501 (denied)
--     insert {user_id:<other>, actor_id:<me>, ...}  -> ok
--   Submit an onboarding / rehire request -> approvers still receive the bell notification.

BEGIN;

SELECT review_fix_202611.snapshot_policies('20261125000600', 'public', 'notifications');

DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
DROP POLICY IF EXISTS rf_notifications_insert ON public.notifications;
CREATE POLICY rf_notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid())
    AND (
      user_id = (SELECT auth.uid())
      OR (SELECT public.is_admin_user())
      OR (SELECT public.is_current_employee_active())
    )
  );

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually) - exact prior policy
-- (supabase/migrations/20260615051032_20709d4e-0829-4661-b73f-c4ddedf7da7f.sql).
-- Alternatively: SELECT review_fix_202611.restore_policies('20261125000600','public','notifications');
-- ======================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS rf_notifications_insert ON public.notifications;
-- DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
-- CREATE POLICY "Authenticated insert notifications" ON public.notifications
--   FOR INSERT TO authenticated WITH CHECK (actor_id IS NULL OR actor_id = auth.uid());
-- COMMIT;
