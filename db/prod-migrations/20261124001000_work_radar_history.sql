-- Minimal work-location reads, scoped to configurable module access and saved reporting/site mappings.
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
 WHERE me.uid IS NOT NULL AND me.active AND c.is_enabled AND c.status IN ('active','approved')
 AND ((_mode='radar' AND (me.admin OR me.radar) AND
   (c.role_key='field_officer' OR ((c.role_key IN ('guard','security_guard') OR (NOT c.non_billable AND c.role_key IS NULL)) AND
    (me.admin OR me.all_units IS TRUE OR c.reports_to=me.cid OR c.unit_id=ANY(me.units) OR EXISTS(SELECT 1 FROM candidate_units cu WHERE cu.candidate_id=c.id AND cu.unit_id=ANY(me.units)) OR EXISTS(SELECT 1 FROM candidate_reporting_managers cm WHERE cm.candidate_id=c.id AND cm.manager_id=me.cid)))))
 OR (_mode='transport' AND (me.admin OR (me.vehicles AND me.driver_widget IS DISTINCT FROM false)) AND lower(d.name)='driver' AND
   (me.admin OR c.reports_to=me.cid OR EXISTS(SELECT 1 FROM candidate_reporting_managers cm WHERE cm.candidate_id=c.id AND cm.manager_id=me.cid) OR c.unit_id=ANY(me.units) OR EXISTS(SELECT 1 FROM candidate_units cu WHERE cu.candidate_id=c.id AND cu.unit_id=ANY(me.units)) OR EXISTS(SELECT 1 FROM employee_scope_assignments esa JOIN units u ON u.id=c.unit_id WHERE esa.candidate_id=me.cid AND ((esa.scope_type='customer' AND esa.scope_id=u.customer_id::text) OR (esa.scope_type='branch' AND esa.scope_id=u.branch_id::text))))))
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
SELECT jsonb_build_object('total',(SELECT count(*) FROM people),'present',(SELECT count(*) FROM people WHERE present),'onDuty',(SELECT count(*) FROM people WHERE check_in_at IS NOT NULL AND check_out_at IS NULL),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.full_name,p.id) FROM people p),'[]'::jsonb));
$$;

CREATE TABLE IF NOT EXISTS public.radar_day_assignments (
 candidate_id uuid NOT NULL, assignment_date date NOT NULL, unit_id uuid NOT NULL,
 unit_name text NOT NULL,unit_code text,customer_name text,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(candidate_id,assignment_date,unit_id)
);
GRANT SELECT ON public.radar_day_assignments TO authenticated;
GRANT ALL ON public.radar_day_assignments TO service_role;
ALTER TABLE public.radar_day_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY radar_day_read ON public.radar_day_assignments FOR SELECT TO authenticated USING (
 (select guard_absence_access_allowed()) AND (candidate_id=(select current_user_candidate_id()) OR (select is_admin_user()) OR (select current_user_module_access('field_sense','view'))));
CREATE TABLE IF NOT EXISTS public.field_visit_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL, candidate_id uuid NOT NULL,
 actor_id uuid, action text NOT NULL, form_data jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.field_visit_history TO authenticated;
GRANT ALL ON public.field_visit_history TO service_role;
ALTER TABLE public.field_visit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_history_read ON public.field_visit_history FOR SELECT TO authenticated USING (
 (select guard_absence_access_allowed()) AND (candidate_id=(select current_user_candidate_id()) OR (select is_admin_user()) OR (select current_user_module_access('field_sense','view'))));
CREATE INDEX IF NOT EXISTS field_visit_history_visit_idx ON public.field_visit_history(visit_id,recorded_at);
CREATE OR REPLACE FUNCTION public.snapshot_field_day(_candidate uuid,_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Snapshot once, not a moving roster on every visit. Future mapping changes cannot alter the saved day.
 IF NOT EXISTS(SELECT 1 FROM radar_day_assignments WHERE candidate_id=_candidate AND assignment_date=_date) THEN
  INSERT INTO radar_day_assignments(candidate_id,assignment_date,unit_id,unit_name,unit_code,customer_name)
  SELECT _candidate,_date,f.unit_id,coalesce(f.unit_name,''),f.unit_code,f.customer_name FROM field_officer_scope f JOIN units u ON u.id=f.unit_id AND u.status='active' WHERE f.candidate_id=_candidate ON CONFLICT DO NOTHING;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.field_day_snapshot_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM candidates WHERE id=NEW.candidate_id AND role_key='field_officer') THEN
  PERFORM snapshot_field_day(NEW.candidate_id,CASE WHEN TG_TABLE_NAME='field_visits' THEN (to_jsonb(NEW)->>'visit_date')::date ELSE (to_jsonb(NEW)->>'punch_date')::date END);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER field_day_snapshot AFTER INSERT ON public.field_visits FOR EACH ROW EXECUTE FUNCTION public.field_day_snapshot_trigger();
CREATE TRIGGER field_punch_day_snapshot AFTER INSERT ON public.self_attendance_punches FOR EACH ROW EXECUTE FUNCTION public.field_day_snapshot_trigger();
CREATE OR REPLACE FUNCTION public.retain_field_visit_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
 INSERT INTO field_visit_history(visit_id,candidate_id,actor_id,action,form_data) VALUES((r->>'id')::uuid,(r->>'candidate_id')::uuid,auth.uid(),TG_OP,r); RETURN NULL;
END $$;
CREATE TRIGGER retain_visit_history AFTER INSERT OR UPDATE OR DELETE ON public.field_visits FOR EACH ROW EXECUTE FUNCTION public.retain_field_visit_history();
-- Preserve existing recorded forms, without claiming a historical assigned-site roster.
INSERT INTO public.field_visit_history(visit_id,candidate_id,action,form_data,recorded_at)
SELECT id,candidate_id,'BASELINE',to_jsonb(v),updated_at FROM public.field_visits v;
CREATE TRIGGER zz_audit AFTER INSERT ON public.field_visit_history FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Radar Visit History');

CREATE OR REPLACE FUNCTION public.radar_visit_summary(_start date,_end date,_search text DEFAULT '',_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT guard_absence_access_allowed() OR NOT (is_admin_user() OR current_user_module_access('field_sense','view')) THEN RAISE EXCEPTION 'Radar access required' USING ERRCODE='42501'; END IF;
 IF _start>_end OR _end>(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Choose a valid historical date range'; END IF;
 RETURN (WITH officers AS MATERIALIZED (
 SELECT c.id,c.full_name,c.employee_code FROM candidates c WHERE (c.role_key='field_officer' AND c.is_enabled AND c.status IN ('active','approved')) OR EXISTS(SELECT 1 FROM field_visits v WHERE v.candidate_id=c.id AND v.visit_date BETWEEN _start AND _end)
 ), counts AS MATERIALIZED (
 SELECT o.*,(SELECT count(DISTINCT v.unit_id) FROM field_visits v WHERE v.candidate_id=o.id AND v.visit_date BETWEEN _start AND _end AND v.check_out_at IS NOT NULL) completed,
 (SELECT count(*) FROM field_visits v WHERE v.candidate_id=o.id AND v.visit_date BETWEEN _start AND _end AND v.check_out_at IS NULL) in_meeting,
 (SELECT count(*) FROM field_visit_requests r WHERE r.candidate_id=o.id AND r.status='acknowledged' AND (r.acknowledged_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN _start AND _end) travelling,
 coalesce((SELECT count(DISTINCT d.unit_id) FROM radar_day_assignments d WHERE d.candidate_id=o.id AND d.assignment_date BETWEEN _start AND _end HAVING count(*)>0),(SELECT count(DISTINCT f.unit_id) FROM field_officer_scope f JOIN units u ON u.id=f.unit_id AND u.status='active' WHERE f.candidate_id=o.id)) assigned
 FROM officers o
 ), filtered AS MATERIALIZED (
 SELECT * FROM counts WHERE NOT EXISTS(SELECT 1 FROM regexp_split_to_table(trim(_search),'\s+') w WHERE w<>'' AND concat_ws(' ',full_name,employee_code) NOT ILIKE '%'||w||'%')
 ), rows AS (SELECT * FROM filtered ORDER BY in_meeting DESC,completed DESC,full_name,id LIMIT 50 OFFSET greatest(_page,0)*50)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM rows r),'[]'::jsonb)));
END $$;
CREATE OR REPLACE FUNCTION public.radar_employee_history(_candidate uuid,_start date,_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT guard_absence_access_allowed() OR NOT (is_admin_user() OR current_user_module_access('field_sense','view')) THEN RAISE EXCEPTION 'Radar access required' USING ERRCODE='42501'; END IF;
 IF _start>_end OR _end>(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Choose a valid historical date range'; END IF;
 RETURN jsonb_build_object('rosterSource',CASE WHEN EXISTS(SELECT 1 FROM radar_day_assignments WHERE candidate_id=_candidate AND assignment_date BETWEEN _start AND _end) THEN 'saved' ELSE 'current' END,
 'assigned',CASE WHEN EXISTS(SELECT 1 FROM radar_day_assignments WHERE candidate_id=_candidate AND assignment_date BETWEEN _start AND _end) THEN
  (SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM (SELECT DISTINCT unit_id,unit_name,unit_code,customer_name FROM radar_day_assignments WHERE candidate_id=_candidate AND assignment_date BETWEEN _start AND _end) a)
 ELSE (SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM (SELECT DISTINCT f.unit_id,f.unit_name,f.unit_code,f.customer_name FROM field_officer_scope f JOIN units u ON u.id=f.unit_id AND u.status='active' WHERE f.candidate_id=_candidate) a) END,
 'visits',(SELECT coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object('unit_name',u.name,'unit_code',u.code,'customer_name',c.name) ORDER BY v.visit_date DESC,v.visit_seq DESC),'[]'::jsonb) FROM field_visits v JOIN units u ON u.id=v.unit_id LEFT JOIN customers c ON c.id=u.customer_id WHERE v.candidate_id=_candidate AND v.visit_date BETWEEN _start AND _end));
END $$;
REVOKE ALL ON FUNCTION public.work_map_people(text,date),public.radar_visit_summary(date,date,text,integer),public.radar_employee_history(uuid,date,date),public.snapshot_field_day(uuid,date),public.field_day_snapshot_trigger(),public.retain_field_visit_history() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.snapshot_field_day(uuid,date),public.field_day_snapshot_trigger(),public.retain_field_visit_history() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.work_map_people(text,date),public.radar_visit_summary(date,date,text,integer),public.radar_employee_history(uuid,date,date) TO authenticated;
NOTIFY pgrst,'reload schema';
