-- Department ownership is independent of role, payroll home and reporting lines.
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS head_candidate_id uuid REFERENCES public.candidates(id);
COMMENT ON COLUMN public.departments.head_candidate_id IS 'Configured department head for own-department My Team attendance reads; does not grant employee editing or global attendance access.';

-- Protect this scope-granting field even if a legacy department policy allows broad edits.
CREATE OR REPLACE FUNCTION public.guard_department_head_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.head_candidate_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.head_candidate_id IS DISTINCT FROM OLD.head_candidate_id) THEN
  IF current_user NOT IN ('postgres','service_role') AND NOT coalesce(((select is_admin_user()) OR ((select current_user_module_access('control_center','edit')) AND (select current_user_explicit_permission('control_center','department_manager','edit')) IS DISTINCT FROM false)),false) THEN
   RAISE EXCEPTION 'Department Manager edit access required to assign a head' USING ERRCODE='42501';
  END IF;
  IF NEW.head_candidate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM candidates WHERE id=NEW.head_candidate_id AND is_enabled AND status IN ('active','approved')) THEN
   RAISE EXCEPTION 'Choose an enabled active employee as department head' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_department_head_change BEFORE INSERT OR UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.guard_department_head_change();
REVOKE ALL ON FUNCTION public.guard_department_head_change() FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.dashboard_department_team(_date date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date, _search text DEFAULT '', _filter text DEFAULT 'all', _page integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH me AS MATERIALIZED (
 SELECT (select auth.uid()) uid,(select current_user_candidate_id()) cid,
 (select guard_absence_access_allowed()) active,
 (select current_user_explicit_permission('dashboard','w_my_team','view')) widget
), departments_owned AS MATERIALIZED (
 SELECT d.id,d.name FROM departments d JOIN candidates h ON h.id=d.head_candidate_id CROSS JOIN me
 WHERE me.uid IS NOT NULL AND me.active AND me.widget IS DISTINCT FROM false
 AND d.enabled AND h.id=me.cid AND h.is_enabled AND h.status IN ('active','approved')
), roster AS MATERIALIZED (
 SELECT c.id,c.full_name,c.employee_code,d.name department,g.name designation
 FROM candidates c JOIN departments_owned d ON d.id=c.department_id
 LEFT JOIN designations g ON g.id=c.designation_id
 WHERE c.is_enabled AND c.status IN ('active','approved') AND c.id<>(SELECT cid FROM me)
), marks AS (
 SELECT e.candidate_id,bool_or(coalesce(ac.counts_as_present,false) OR e.ot_hours>0 OR e.code IN ('ED','OT')) present
 FROM attendance_entries e JOIN roster r ON r.id=e.candidate_id LEFT JOIN attendance_codes ac ON ac.code=e.code
 WHERE e.entry_date=_date GROUP BY e.candidate_id
), people AS MATERIALIZED (
 SELECT r.*,p.check_in_at,p.check_out_at,(p.check_in_at IS NOT NULL OR coalesce(m.present,false)) present
 FROM roster r LEFT JOIN marks m ON m.candidate_id=r.id
 LEFT JOIN self_attendance_punches p ON p.candidate_id=r.id AND p.punch_date=_date
), filtered AS MATERIALIZED (
 SELECT * FROM people WHERE CASE _filter WHEN 'present' THEN present WHEN 'absent' THEN NOT present ELSE true END
 AND NOT EXISTS(SELECT 1 FROM regexp_split_to_table(trim(_search),'\s+') w WHERE w<>'' AND concat_ws(' ',full_name,employee_code,designation,department) NOT ILIKE '%'||w||'%')
), page_rows AS (SELECT * FROM filtered ORDER BY full_name,id LIMIT 25 OFFSET greatest(0,least(_page,10000))*25)
SELECT jsonb_build_object('isHead',EXISTS(SELECT 1 FROM departments_owned),'departments',coalesce((SELECT jsonb_agg(name ORDER BY name) FROM departments_owned),'[]'::jsonb),
 'total',(SELECT count(*) FROM people),'present',(SELECT count(*) FROM people WHERE present),'absent',(SELECT count(*) FROM people WHERE NOT present),
 'filteredTotal',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY full_name,id) FROM page_rows p),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.dashboard_department_team(date,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_department_team(date,text,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
-- A timestamp without a complete device fix must not hide saved check-in GPS.
CREATE OR REPLACE FUNCTION public.work_map_people(_mode text DEFAULT 'radar'::text, _date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL OR p.last_lat IS NULL OR p.last_lng IS NULL OR abs(p.last_lat)>90 OR abs(p.last_lng)>180 THEN p.check_in_lat ELSE p.last_lat END lat,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL OR p.last_lat IS NULL OR p.last_lng IS NULL OR abs(p.last_lat)>90 OR abs(p.last_lng)>180 THEN p.check_in_lng ELSE p.last_lng END lng,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL OR p.last_lat IS NULL OR p.last_lng IS NULL OR abs(p.last_lat)>90 OR abs(p.last_lng)>180 THEN p.check_in_accuracy ELSE p.last_accuracy END accuracy,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL OR p.last_lat IS NULL OR p.last_lng IS NULL OR abs(p.last_lat)>90 OR abs(p.last_lng)>180 THEN p.check_in_at ELSE p.last_seen_at END located_at,
 CASE WHEN r.kind='guard' OR p.last_seen_at IS NULL OR p.last_lat IS NULL OR p.last_lng IS NULL OR abs(p.last_lat)>90 OR abs(p.last_lng)>180 THEN 'check_in' ELSE 'telemetry' END location_source,u.name unit_name
 FROM roster r LEFT JOIN marks m ON m.candidate_id=r.id LEFT JOIN self_attendance_punches p ON p.candidate_id=r.id AND p.punch_date=_date LEFT JOIN units u ON u.id=coalesce(p.unit_id,r.unit_id)
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM people),'present',(SELECT count(*) FROM people WHERE present),'onDuty',(SELECT count(*) FROM people WHERE check_in_at IS NOT NULL AND check_out_at IS NULL),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.full_name,p.id) FROM people p WHERE _mode='transport' OR p.check_in_at IS NOT NULL),'[]'::jsonb));
$function$;


NOTIFY pgrst,'reload schema';

-- Distinguish repeat visit forms from unique client sites.
CREATE OR REPLACE FUNCTION public.radar_visit_summary(_start date, _end date, _search text DEFAULT ''::text, _page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT guard_absence_access_allowed() OR NOT (is_admin_user() OR current_user_module_access('field_sense','view')) THEN RAISE EXCEPTION 'Radar access required' USING ERRCODE='42501'; END IF;
 IF _start>_end OR _end>(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Choose a valid historical date range'; END IF;
 RETURN (WITH officers AS MATERIALIZED (
 SELECT c.id,c.full_name,c.employee_code FROM candidates c WHERE (c.role_key='field_officer' AND c.is_enabled AND c.status IN ('active','approved')) OR EXISTS(SELECT 1 FROM field_visits v WHERE v.candidate_id=c.id AND v.visit_date BETWEEN _start AND _end)
 ), counts AS MATERIALIZED (
 SELECT o.*,(SELECT count(DISTINCT v.unit_id) FROM field_visits v WHERE v.candidate_id=o.id AND v.visit_date BETWEEN _start AND _end AND v.check_out_at IS NOT NULL) completed,
 (SELECT count(*) FROM field_visits v WHERE v.candidate_id=o.id AND v.visit_date BETWEEN _start AND _end AND v.check_out_at IS NOT NULL) completed_visits,
 (SELECT count(*) FROM field_visits v WHERE v.candidate_id=o.id AND v.visit_date BETWEEN _start AND _end AND v.check_out_at IS NULL) in_meeting,
 (SELECT count(*) FROM field_visit_requests r WHERE r.candidate_id=o.id AND r.status='acknowledged' AND (r.acknowledged_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN _start AND _end) travelling,
 coalesce((SELECT count(DISTINCT d.unit_id) FROM radar_day_assignments d WHERE d.candidate_id=o.id AND d.assignment_date BETWEEN _start AND _end HAVING count(*)>0),(SELECT count(DISTINCT f.unit_id) FROM field_officer_scope f JOIN units u ON u.id=f.unit_id AND u.status='active' WHERE f.candidate_id=o.id)) assigned
 FROM officers o
 ), filtered AS MATERIALIZED (
 SELECT * FROM counts WHERE NOT EXISTS(SELECT 1 FROM regexp_split_to_table(trim(_search),'\s+') w WHERE w<>'' AND concat_ws(' ',full_name,employee_code) NOT ILIKE '%'||w||'%')
 ), rows AS (SELECT * FROM filtered ORDER BY in_meeting DESC,completed DESC,full_name,id LIMIT 50 OFFSET greatest(_page,0)*50)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM rows r),'[]'::jsonb)));
END $function$;
NOTIFY pgrst,'reload schema';

-- Only the two explicitly named heads are configured; other departments await user selection.
UPDATE public.departments SET head_candidate_id=(SELECT id FROM public.candidates WHERE employee_code='494185' AND full_name='Noor Singh') WHERE name='Legal' AND head_candidate_id IS NULL;
UPDATE public.departments SET head_candidate_id=(SELECT id FROM public.candidates WHERE employee_code='26881' AND full_name='Shahid Hussain') WHERE name='Transport' AND head_candidate_id IS NULL;
CREATE INDEX IF NOT EXISTS candidates_active_department_team_idx ON public.candidates(department_id,id) WHERE is_enabled AND status IN ('active','approved');
