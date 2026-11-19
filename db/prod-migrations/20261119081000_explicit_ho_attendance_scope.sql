-- Include explicit active non-billable site mappings only in the dashboard attendance read.
-- Do not broaden the billing-unit helper or change payroll homes/reporting chains.
CREATE OR REPLACE FUNCTION public.dashboard_attendance_people(_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date, _search text DEFAULT ''::text, _filter text DEFAULT 'all'::text, _page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH me AS (
 SELECT (select auth.uid()) uid,(select current_user_candidate_id()) cid,
 (select is_admin_user()) admin,ARRAY(SELECT unnest((select current_user_unit_ids())) UNION SELECT u.id FROM employee_scope_assignments esa JOIN units u ON u.id::text=esa.scope_id WHERE esa.candidate_id=(select current_user_candidate_id()) AND esa.scope_type='unit' AND u.status='active') units,
 (select current_user_explicit_permission('attendance','all_units','view')) all_units,
 (select current_user_module_access('dashboard','view')) allowed,
 (select current_user_explicit_permission('dashboard','w_attendance_today','view')) widget
), roster AS MATERIALIZED (
 SELECT c.id,c.full_name,c.employee_code,c.role_key,d.name department,g.name designation,u.name unit_name
 FROM candidates c LEFT JOIN departments d ON d.id=c.department_id LEFT JOIN designations g ON g.id=c.designation_id
 LEFT JOIN units u ON u.id=c.unit_id CROSS JOIN me
 WHERE me.uid IS NOT NULL AND (me.admin OR (me.allowed AND me.widget IS DISTINCT FROM false))
 AND c.status IN ('active','approved') AND c.is_enabled IS TRUE
 AND (me.admin OR me.all_units IS TRUE OR c.id=me.cid OR c.reports_to=me.cid
 OR EXISTS(SELECT 1 FROM candidate_reporting_managers r WHERE r.candidate_id=c.id AND r.manager_id=me.cid)
 OR ((c.unit_id=ANY(me.units) OR EXISTS(SELECT 1 FROM candidate_units cu WHERE cu.candidate_id=c.id AND cu.unit_id=ANY(me.units))) AND u.status='active'))
), marks AS (
 SELECT e.candidate_id,bool_or(coalesce(ac.counts_as_present,false) OR e.ot_hours>0 OR e.code IN ('ED','OT')) present
 FROM attendance_entries e JOIN roster r ON r.id=e.candidate_id CROSS JOIN me
 LEFT JOIN attendance_codes ac ON ac.code=e.code
 WHERE e.entry_date=_date AND (me.admin OR me.all_units IS TRUE OR e.unit_id=ANY(me.units)
 OR r.id=me.cid OR EXISTS(SELECT 1 FROM candidates c WHERE c.id=r.id AND c.reports_to=me.cid)
 OR EXISTS(SELECT 1 FROM candidate_reporting_managers cm WHERE cm.candidate_id=r.id AND cm.manager_id=me.cid))
 GROUP BY e.candidate_id
), people AS MATERIALIZED (
 SELECT r.*,p.check_in_at,p.check_out_at,p.check_in_lat,p.check_in_lng,p.check_in_accuracy,p.check_in_place,
 coalesce(pu.name,r.unit_name) check_in_unit,
 (p.check_in_at IS NOT NULL OR coalesce(m.present,false)) present_today
 FROM roster r LEFT JOIN marks m ON m.candidate_id=r.id
 LEFT JOIN self_attendance_punches p ON p.candidate_id=r.id AND p.punch_date=_date
 AND ((SELECT admin OR all_units IS TRUE FROM me) OR p.unit_id=ANY((SELECT units FROM me)::uuid[]) OR r.id=(SELECT cid FROM me)
 OR EXISTS(SELECT 1 FROM candidates c WHERE c.id=r.id AND c.reports_to=(SELECT cid FROM me))
 OR EXISTS(SELECT 1 FROM candidate_reporting_managers cm WHERE cm.candidate_id=r.id AND cm.manager_id=(SELECT cid FROM me)))
 LEFT JOIN units pu ON pu.id=p.unit_id
), filtered AS MATERIALIZED (
 SELECT * FROM people WHERE NOT EXISTS(SELECT 1 FROM regexp_split_to_table(trim(_search),'\s+') w WHERE w<>'' AND concat_ws(' ',full_name,employee_code,department,designation,unit_name) NOT ILIKE '%'||w||'%')
 AND CASE _filter WHEN 'present' THEN present_today WHEN 'not_present' THEN NOT present_today WHEN 'checked_in' THEN check_in_at IS NOT NULL WHEN 'on_duty' THEN check_in_at IS NOT NULL AND check_out_at IS NULL ELSE true END
), page_rows AS (SELECT * FROM filtered ORDER BY full_name,id LIMIT 50 OFFSET greatest(0,least(_page,10000))*50)
SELECT jsonb_build_object('total',(SELECT count(*) FROM people),'present',(SELECT count(*) FROM people WHERE present_today),
 'checkedIn',(SELECT count(*) FROM people WHERE check_in_at IS NOT NULL),'onDuty',(SELECT count(*) FROM people WHERE check_in_at IS NOT NULL AND check_out_at IS NULL),
 'filteredTotal',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page_rows p),'[]'::jsonb));
$function$

