CREATE POLICY "Users read own scope assignments" ON public.employee_scope_assignments
  FOR SELECT TO authenticated USING (candidate_id = (SELECT public.current_user_candidate_id()));
