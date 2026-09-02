DROP POLICY IF EXISTS "Admins insert payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins update payroll_runs" ON public.payroll_runs;

CREATE POLICY "Authorized workflow users insert payroll_runs"
ON public.payroll_runs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_user()
  OR (
    (
      public.current_user_has_permission('attendance', '', 'approve')
      OR public.current_user_has_permission('payroll', '', 'edit')
      OR public.current_user_has_permission('payroll', '', 'approve')
      OR public.current_user_has_permission('invoice', '', 'edit')
      OR public.current_user_has_permission('invoice', '', 'approve')
    )
    AND (
      NOT public.current_user_has_branch_scope()
      OR public.is_unit_in_current_user_branch(unit_id)
    )
  )
);

CREATE POLICY "Authorized workflow users update payroll_runs"
ON public.payroll_runs
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user()
  OR (
    (
      public.current_user_has_permission('attendance', '', 'approve')
      OR public.current_user_has_permission('payroll', '', 'edit')
      OR public.current_user_has_permission('payroll', '', 'approve')
      OR public.current_user_has_permission('invoice', '', 'edit')
      OR public.current_user_has_permission('invoice', '', 'approve')
    )
    AND (
      NOT public.current_user_has_branch_scope()
      OR public.is_unit_in_current_user_branch(unit_id)
    )
  )
)
WITH CHECK (
  public.is_admin_user()
  OR (
    (
      public.current_user_has_permission('attendance', '', 'approve')
      OR public.current_user_has_permission('payroll', '', 'edit')
      OR public.current_user_has_permission('payroll', '', 'approve')
      OR public.current_user_has_permission('invoice', '', 'edit')
      OR public.current_user_has_permission('invoice', '', 'approve')
    )
    AND (
      NOT public.current_user_has_branch_scope()
      OR public.is_unit_in_current_user_branch(unit_id)
    )
  )
);