-- Operational driver-team membership is separate from payroll homes and primary reporting managers.
CREATE TABLE IF NOT EXISTS public.transport_team_members (
 manager_id uuid NOT NULL REFERENCES public.candidates(id),driver_id uuid NOT NULL REFERENCES public.candidates(id),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(manager_id,driver_id)
);
GRANT SELECT ON public.transport_team_members TO authenticated;
GRANT ALL ON public.transport_team_members TO service_role;
ALTER TABLE public.transport_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_team_read ON public.transport_team_members FOR SELECT TO authenticated USING (
 (select guard_absence_access_allowed()) AND (manager_id=(select current_user_candidate_id()) OR (select is_admin_user())));
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.transport_team_members FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Transport Team');
CREATE OR REPLACE FUNCTION public.current_user_transport_team_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id FROM candidates c JOIN designations d ON d.id=c.designation_id
 WHERE (select auth.uid()) IS NOT NULL AND (select guard_absence_access_allowed()) AND c.is_enabled AND c.status IN ('active','approved') AND lower(d.name)='driver'
 AND ((select is_admin_user()) OR ((select current_user_module_access('vehicles','view')) AND
 ((EXISTS(SELECT 1 FROM transport_team_members t WHERE t.driver_id=c.id AND t.manager_id=(select current_user_candidate_id())) AND (select current_user_explicit_permission('vehicles','driver_team_all','view')) IS TRUE)
 OR c.reports_to=(select current_user_candidate_id()) OR EXISTS(SELECT 1 FROM candidate_reporting_managers r WHERE r.candidate_id=c.id AND r.manager_id=(select current_user_candidate_id()))
 OR c.unit_id=ANY((select current_user_unit_ids())::uuid[]) OR EXISTS(SELECT 1 FROM candidate_units cu WHERE cu.candidate_id=c.id AND cu.unit_id=ANY((select current_user_unit_ids())::uuid[])))));
$$;
NOTIFY pgrst,'reload schema';
