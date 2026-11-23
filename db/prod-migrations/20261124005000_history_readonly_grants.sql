-- Remove inherited default write grants as well as using SELECT-only policies.
REVOKE ALL ON public.radar_day_assignments,public.field_visit_history,public.transport_team_members FROM anon,authenticated;
GRANT SELECT ON public.radar_day_assignments,public.field_visit_history,public.transport_team_members TO authenticated;
GRANT ALL ON public.radar_day_assignments,public.field_visit_history,public.transport_team_members TO service_role;
NOTIFY pgrst,'reload schema';
