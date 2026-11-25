-- 20261125000700_payroll_snapshots_runs_rls.sql
-- RISK: MEDIUM - apply after the role check below (no app code change needed).
--
-- CLOSES: S6 / L18 (payroll part).
--   payroll_run_snapshots (feeds bank file and wage slips):
--     * any signed-in user except hr_executive could INSERT/UPDATE/DELETE
--       (WITH CHECK role <> 'hr_executive');
--     * users with no branch scope (guards!) could read company-wide net pay.
--   payroll_runs: same "no branch scope = everything" read.
--
-- NEW RULES (existing helpers only, nothing role-hardcoded except the pre-existing
-- hr_executive unit scoping, which is preserved verbatim):
--   payroll_run_snapshots SELECT  rf_prs_read:
--       own rows (candidate_id IN current_user_candidate_ids())
--    OR ( (admin OR Payroll view OR Invoice view [= finance] OR payroll approver/processor workflow)
--         AND <previous branch / hr_executive scope expression, unchanged> )
--   payroll_run_snapshots INSERT/UPDATE/DELETE rf_prs_insert/update/delete:
--       (admin OR Payroll edit (current_user_module_access) OR current_user_can_process_payroll())
--       AND role <> 'hr_executive' (previous rule kept)
--     -> save_payroll_posting_atomic (SECURITY INVOKER, already requires
--        current_user_can_process_payroll) keeps working.
--   payroll_runs SELECT "Scoped read payroll_runs" -> rf_payroll_runs_read:
--       (admin OR Payroll/Invoice/Attendance view OR payroll approver/processor
--        OR the run is for one of my own units (current_user_unit_ids()))
--       AND <previous scope expression, unchanged>
--     "Admins select payroll_runs" and the insert/update policies are untouched.
--     Attendance view is included because attendance sheets, AttendanceCharter,
--     PeriodStatusBadge and the dashboard read payroll_runs status rows to lock periods.
--
-- AFFECTED SCREENS / ROLES:
--   * Payroll list/detail, Process, PT cross-site (pt-cross-site.ts / payroll-engine.ts
--     read snapshots) - need Payroll view (unchanged for payroll users).
--   * Invoice / finance screens reading posted values - need Invoice view.
--   * Employee "my payslip"-type reads - own rows only.
--   * Dashboard / registers period status for users with none of Payroll, Invoice,
--     Attendance view: they now see status only for their own units.
--   * finance-refresh worker uses supabaseAdmin (service_role) - unaffected.
--   PRE-CHECK (run first; any role listed that should NOT see payroll means its
--   Access Control grant is the problem, not this migration):
--     SELECT role_key, module_key, sub_module_key, can_view, can_edit FROM public.role_permissions
--      WHERE module_key IN ('payroll','invoice','attendance') AND (can_view OR can_edit OR can_approve)
--      ORDER BY 1,2,3;
--     -- If 'guard' has payroll/invoice view, guards will still read snapshots in scope.
--
-- VERIFY AFTER APPLYING:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('payroll_run_snapshots','payroll_runs') ORDER BY 1;
--   "View as" an Armed Guard: GET payroll_run_snapshots -> only own rows (0 for most guards);
--   payroll user: payroll page for a processed site shows snapshots; Process a test site succeeds.

BEGIN;

SELECT review_fix_202611.snapshot_policies('20261125000700', 'public', 'payroll_run_snapshots');
SELECT review_fix_202611.snapshot_policies('20261125000700', 'public', 'payroll_runs');

-- ---------- payroll_run_snapshots ----------
DROP POLICY IF EXISTS "Scoped read payroll_run_snapshots" ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS "Authenticated write payroll_run_snapshots" ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS "Authenticated update payroll_run_snapshots" ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS "Authenticated delete payroll_run_snapshots" ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS rf_prs_read ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS rf_prs_insert ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS rf_prs_update ON public.payroll_run_snapshots;
DROP POLICY IF EXISTS rf_prs_delete ON public.payroll_run_snapshots;

CREATE POLICY rf_prs_read ON public.payroll_run_snapshots
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT public.current_user_candidate_ids())
    OR (
      ( (SELECT public.is_admin_user())
        OR (SELECT public.current_user_module_access('payroll','view'))
        OR (SELECT public.current_user_module_access('invoice','view'))
        OR (SELECT public.current_user_can_process_payroll())
        OR (SELECT public.current_user_can_approve_payroll()) )
      AND (
        (coalesce((SELECT public.current_user_role_key()),'')='hr_executive'
          AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids()))))
        OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive'
          AND ((SELECT public.is_admin_user()) OR NOT (SELECT public.current_user_has_branch_scope())
               OR public.is_unit_in_current_user_branch(unit_id)))
      )
    )
  );

CREATE POLICY rf_prs_insert ON public.payroll_run_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive'
    AND ( (SELECT public.is_admin_user())
          OR (SELECT public.current_user_module_access('payroll','edit'))
          OR (SELECT public.current_user_can_process_payroll()) )
  );

CREATE POLICY rf_prs_update ON public.payroll_run_snapshots
  FOR UPDATE TO authenticated
  USING (
    coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive'
    AND ( (SELECT public.is_admin_user())
          OR (SELECT public.current_user_module_access('payroll','edit'))
          OR (SELECT public.current_user_can_process_payroll()) )
  )
  WITH CHECK (
    coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive'
    AND ( (SELECT public.is_admin_user())
          OR (SELECT public.current_user_module_access('payroll','edit'))
          OR (SELECT public.current_user_can_process_payroll()) )
  );

CREATE POLICY rf_prs_delete ON public.payroll_run_snapshots
  FOR DELETE TO authenticated
  USING (
    coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive'
    AND ( (SELECT public.is_admin_user())
          OR (SELECT public.current_user_module_access('payroll','edit'))
          OR (SELECT public.current_user_can_process_payroll()) )
  );

-- ---------- payroll_runs (read only) ----------
DROP POLICY IF EXISTS "Scoped read payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS rf_payroll_runs_read ON public.payroll_runs;
CREATE POLICY rf_payroll_runs_read ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (
    ( (SELECT public.is_admin_user())
      OR (SELECT public.current_user_module_access('payroll','view'))
      OR (SELECT public.current_user_module_access('invoice','view'))
      OR (SELECT public.current_user_module_access('attendance','view'))
      OR (SELECT public.current_user_can_process_payroll())
      OR (SELECT public.current_user_can_approve_payroll())
      OR unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids()))) )
    AND (
      (coalesce((SELECT public.current_user_role_key()),'')='hr_executive'
        AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids()))))
      OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive'
        AND ((SELECT public.is_admin_user()) OR NOT (SELECT public.current_user_has_branch_scope())
             OR public.is_unit_in_current_user_branch(unit_id)))
    )
  );

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually).
-- Preferred (restores the exact LIVE policies captured at apply time):
--   BEGIN;
--   SELECT review_fix_202611.restore_policies('20261125000700','public','payroll_run_snapshots');
--   SELECT review_fix_202611.restore_policies('20261125000700','public','payroll_runs');
--   COMMIT;
-- Static fallback = latest repo definitions
-- (supabase/migrations/20260805034146_68725b2e-...sql + db/prod-migrations/20260925150000_hr_executive_access_cleanup.sql:105-109):
-- ======================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS rf_prs_read ON public.payroll_run_snapshots;
-- DROP POLICY IF EXISTS rf_prs_insert ON public.payroll_run_snapshots;
-- DROP POLICY IF EXISTS rf_prs_update ON public.payroll_run_snapshots;
-- DROP POLICY IF EXISTS rf_prs_delete ON public.payroll_run_snapshots;
-- DROP POLICY IF EXISTS rf_payroll_runs_read ON public.payroll_runs;
-- CREATE POLICY "Scoped read payroll_run_snapshots" ON public.payroll_run_snapshots FOR SELECT TO authenticated
--   USING ((coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id))));
-- CREATE POLICY "Authenticated write payroll_run_snapshots" ON public.payroll_run_snapshots FOR INSERT TO authenticated
--   WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
-- CREATE POLICY "Authenticated update payroll_run_snapshots" ON public.payroll_run_snapshots FOR UPDATE TO authenticated
--   USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive') WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
-- CREATE POLICY "Authenticated delete payroll_run_snapshots" ON public.payroll_run_snapshots FOR DELETE TO authenticated
--   USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
-- CREATE POLICY "Scoped read payroll_runs" ON public.payroll_runs FOR SELECT TO authenticated
--   USING ((coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND ((SELECT public.is_admin_user()) OR NOT (SELECT public.current_user_has_branch_scope()) OR public.is_unit_in_current_user_branch(unit_id))));
-- COMMIT;
