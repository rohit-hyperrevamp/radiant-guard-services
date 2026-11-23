-- Transport department ownership is an operational mapping, not a payroll/reporting-manager change.
-- The new map adds the caller's department only when a saved employee-level Vehicles View-All switch grants it.
CREATE OR REPLACE FUNCTION public.current_user_transport_team_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id FROM candidates c JOIN designations d ON d.id=c.designation_id
 WHERE (select auth.uid()) IS NOT NULL AND (select guard_absence_access_allowed()) AND c.is_enabled AND c.status IN ('active','approved') AND lower(d.name)='driver'
 AND ((select is_admin_user()) OR ((select current_user_module_access('vehicles','view')) AND
 ((c.department_id=(SELECT department_id FROM candidates WHERE id=(select current_user_candidate_id())) AND (select current_user_explicit_permission('vehicles','driver_team_all','view')) IS TRUE)
 OR c.reports_to=(select current_user_candidate_id()) OR EXISTS(SELECT 1 FROM candidate_reporting_managers r WHERE r.candidate_id=c.id AND r.manager_id=(select current_user_candidate_id()))
 OR c.unit_id=ANY((select current_user_unit_ids())::uuid[]) OR EXISTS(SELECT 1 FROM candidate_units cu WHERE cu.candidate_id=c.id AND cu.unit_id=ANY((select current_user_unit_ids())::uuid[])))));
$$;
REVOKE ALL ON FUNCTION public.current_user_transport_team_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_user_transport_team_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.work_map_people(_mode text DEFAULT 'radar',_date date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH me AS MATERIALIZED (
 SELECT (select auth.uid()) uid,(select current_user_candidate_id()) cid,(select is_admin_user()) admin,
 (select current_user_module_access('field_sense','view')) radar,
 (select current_user_module_access('vehicles','view')) vehicles,
 (select current_user_explicit_permission('dashboard','w_driver_team','view')) driver_widget,
 (select current_user_explicit_permission('attendance','all_units','view')) all_units,
 (select current_user_unit_ids()) units,(select guard_absence_access_allowed()) active
), roster AS MATERIALIZED (
 SELECT c.id,c.full_name,c.employee_code,c.role_key,c.unit_id,
 CASE WHEN _mode='transport' THEN 'driver' WHEN c.role_key='field_officer' THEN 'field_officer' ELSE 'guard' END kind
 FROM candidates c LEFT JOIN designations d ON d.id=c.designation_id CROSS JOIN me
 WHERE me.uid IS NOT NULL AND me.active AND c.is_enabled AND c.status IN ('active','approved') AND (c.role_key='field_officer' OR EXISTS(SELECT 1 FROM units home WHERE home.id=c.unit_id AND home.status='active'))
 AND ((_mode='radar' AND (me.admin OR me.radar) AND
   (c.role_key='field_officer' OR ((c.role_key IN ('guard','security_guard') OR (NOT c.non_billable AND c.role_key IS NULL)) AND
    (me.admin OR me.all_units IS TRUE OR c.reports_to=me.cid OR c.unit_id=ANY(me.units) OR EXISTS(SELECT 1 FROM candidate_units cu WHERE cu.candidate_id=c.id AND cu.unit_id=ANY(me.units)) OR EXISTS(SELECT 1 FROM candidate_reporting_managers cm WHERE cm.candidate_id=c.id AND cm.manager_id=me.cid)))))
 OR (_mode='transport' AND (me.admin OR (me.vehicles AND me.driver_widget IS DISTINCT FROM false)) AND c.id IN (SELECT current_user_transport_team_ids())))
), marks AS (
 SELECT e.candidate_id,bool_or(coalesce(a.counts_as_present,false) OR e.ot_hours>0 OR e.code IN ('ED','OT')) present
 FROM attendance_entries e JOIN roster r ON r.id=e.candidate_id LEFT JOIN attendance_codes a ON a.code=e.code
 WHERE e.entry_date=_date GROUP BY e.candidate_id
), people AS MATERIALIZED (
 SELECT r.id,r.full_name,r.employee_code,r.kind,p.check_in_at,p.check_out_at,
 (p.check_in_at IS NOT NULL OR coalesce(m.present,false)) present,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL THEN p.check_in_lat ELSE p.last_lat END lat,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL THEN p.check_in_lng ELSE p.last_lng END lng,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL THEN p.check_in_accuracy ELSE p.last_accuracy END accuracy,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL THEN p.check_in_at ELSE p.last_seen_at END located_at,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL THEN 'check_in' ELSE 'telemetry' END location_source,u.name unit_name
 FROM roster r LEFT JOIN marks m ON m.candidate_id=r.id LEFT JOIN self_attendance_punches p ON p.candidate_id=r.id AND p.punch_date=_date LEFT JOIN units u ON u.id=coalesce(p.unit_id,r.unit_id)
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM people),'present',(SELECT count(*) FROM people WHERE present),'onDuty',(SELECT count(*) FROM people WHERE check_in_at IS NOT NULL AND check_out_at IS NULL),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.full_name,p.id) FROM people p WHERE _mode='transport' OR p.check_in_at IS NOT NULL),'[]'::jsonb));
$$;

NOTIFY pgrst,'reload schema';
