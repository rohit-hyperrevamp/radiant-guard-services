DROP POLICY IF EXISTS "fvr admins manage all" ON public.field_visit_requests;
CREATE POLICY "fvr admins manage all" ON public.field_visit_requests FOR ALL TO authenticated
  USING (is_admin_user() OR (current_user_role_key() = ANY (ARRAY['hr','leadership','admin','super_admin','vp_operations','control_center_head'])) OR current_user_can_edit_organizations())
  WITH CHECK (is_admin_user() OR (current_user_role_key() = ANY (ARRAY['hr','leadership','admin','super_admin','vp_operations','control_center_head'])) OR current_user_can_edit_organizations());
