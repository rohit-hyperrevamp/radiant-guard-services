-- Hot-path fix: evaluate zero-arg auth helpers once per query, not once per row.
DROP POLICY IF EXISTS "Field officers read assigned attendance_entries" ON public.attendance_entries;
CREATE POLICY "Field officers read assigned attendance_entries" ON public.attendance_entries
FOR SELECT TO authenticated
USING (((SELECT public.current_user_role_key()) = 'field_officer') AND public.current_user_can_manage_attendance_unit(unit_id));

DROP POLICY IF EXISTS "Scoped read attendance_entries" ON public.attendance_entries;
CREATE POLICY "Scoped read attendance_entries" ON public.attendance_entries
FOR SELECT TO authenticated
USING (
  ((COALESCE((SELECT public.current_user_role_key()), '') = 'hr_executive')
     AND unit_id = ANY (COALESCE((SELECT public.current_user_unit_ids()), '{}'::uuid[])))
  OR ((COALESCE((SELECT public.current_user_role_key()), '') <> 'hr_executive')
     AND ((SELECT public.is_admin_user()) OR (NOT (SELECT public.current_user_has_branch_scope()))
          OR public.is_unit_in_current_user_branch(unit_id)))
);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_date_id ON public.attendance_entries (entry_date, id);
