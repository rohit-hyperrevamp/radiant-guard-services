-- Production-targeted additive migration. Never apply to the spare preview database.
CREATE TABLE public.guard_absence_policy (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 enabled boolean NOT NULL DEFAULT false,
 alerts_enabled boolean NOT NULL DEFAULT true,
 termination_enabled boolean NOT NULL DEFAULT false,
 termination_days integer NOT NULL DEFAULT 15 CHECK (termination_days BETWEEN 15 AND 365),
 warning_days integer[] NOT NULL DEFAULT ARRAY[10,15,20],
 role_keys text[] NOT NULL DEFAULT ARRAY['guard'] CHECK (role_keys=ARRAY['guard']),
 department_ids uuid[] NOT NULL DEFAULT '{}',
 activated_on date,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (cardinality(warning_days)>0 AND 0<ALL(warning_days) AND 365>=ALL(warning_days)),
 CHECK (termination_days>ANY(warning_days))
);
GRANT SELECT,INSERT,UPDATE ON public.guard_absence_policy TO authenticated;
GRANT ALL ON public.guard_absence_policy TO service_role;
ALTER TABLE public.guard_absence_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY absence_policy_read ON public.guard_absence_policy FOR SELECT TO authenticated USING
 ((select public.current_user_has_permission('control_center','absence_policy','view')));
CREATE POLICY absence_policy_insert ON public.guard_absence_policy FOR INSERT TO authenticated WITH CHECK
 ((select public.current_user_has_permission('control_center','absence_policy','edit')));
CREATE POLICY absence_policy_update ON public.guard_absence_policy FOR UPDATE TO authenticated USING
 ((select public.current_user_has_permission('control_center','absence_policy','edit'))) WITH CHECK
 ((select public.current_user_has_permission('control_center','absence_policy','edit')));
CREATE TRIGGER rbac_guard BEFORE INSERT OR UPDATE OR DELETE ON public.guard_absence_policy
 FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_table_permission('control_center','absence_policy');
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.guard_absence_policy
 FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Guard Absence Policy');

CREATE TABLE public.guard_absence_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL,
 streak_start date NOT NULL,
 through_date date NOT NULL,
 absent_days integer NOT NULL,
 status text NOT NULL DEFAULT 'warning' CHECK (status IN ('warning','pending','terminated','resolved','rejected','cancelled')),
 approval_request_id uuid REFERENCES public.approval_requests(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,streak_start)
);
GRANT SELECT ON public.guard_absence_cases TO authenticated;
GRANT ALL ON public.guard_absence_cases TO service_role;
ALTER TABLE public.guard_absence_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY absence_cases_read ON public.guard_absence_cases FOR SELECT TO authenticated USING (
 candidate_id=(select public.current_user_candidate_id()) OR
 (select public.current_user_has_permission('control_center','absence_policy','view')) OR
 (select public.current_user_in_workflow('guard_absence_termination')) OR
 EXISTS (SELECT 1 FROM public.candidate_reporting_managers m WHERE m.candidate_id=guard_absence_cases.candidate_id AND m.manager_id=(select public.current_user_candidate_id())) OR
 EXISTS (SELECT 1 FROM public.candidates c WHERE c.id=guard_absence_cases.candidate_id AND c.reports_to=(select public.current_user_candidate_id()))
);
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.guard_absence_cases
 FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Guard Absence');

CREATE TABLE public.guard_absence_alerts (
 case_id uuid NOT NULL REFERENCES public.guard_absence_cases(id),
 milestone integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(case_id,milestone)
);
GRANT SELECT ON public.guard_absence_alerts TO authenticated;
GRANT ALL ON public.guard_absence_alerts TO service_role;
ALTER TABLE public.guard_absence_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY absence_alerts_read ON public.guard_absence_alerts FOR SELECT TO authenticated USING
 (EXISTS (SELECT 1 FROM public.guard_absence_cases c WHERE c.id=case_id));

-- A durable access decision is checked by every device. No auth schema writes.
CREATE TABLE public.guard_absence_access_blocks (
 candidate_id uuid PRIMARY KEY,
 user_id uuid,
 case_id uuid NOT NULL REFERENCES public.guard_absence_cases(id),
 blocked_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
GRANT SELECT ON public.guard_absence_access_blocks TO authenticated;
GRANT ALL ON public.guard_absence_access_blocks TO service_role;
ALTER TABLE public.guard_absence_access_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY absence_blocks_read ON public.guard_absence_access_blocks FOR SELECT TO authenticated USING
 (user_id=(select auth.uid()) OR (select public.current_user_has_permission('control_center','absence_policy','view')));
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.guard_absence_access_blocks
 FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Guard Absence Access');

CREATE FUNCTION public.prepare_guard_absence_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.enabled AND (TG_OP='INSERT' OR NOT OLD.enabled) THEN
   NEW.activated_on := (now() AT TIME ZONE 'Asia/Kolkata')::date;
 ELSIF TG_OP='UPDATE' THEN NEW.activated_on:=OLD.activated_on;
 ELSE NEW.activated_on:=NULL;
 END IF;
 IF NEW.termination_enabled AND NEW.enabled AND public.approval_first_step('guard_absence_termination') IS NULL THEN
   RAISE EXCEPTION 'Configure active Guard Absence Termination approval steps in Workflow Manager first';
 END IF;
 NEW.updated_at:=now();
 RETURN NEW;
END $$;
CREATE TRIGGER prepare_absence_policy BEFORE INSERT OR UPDATE ON public.guard_absence_policy
 FOR EACH ROW EXECUTE FUNCTION public.prepare_guard_absence_policy();

-- Mobile-app guards: a day with no punch and no attendance counts as absent.
-- Guards who have never punched in the app: only an explicit Absent (A) entry counts.
-- Presence, Extra Duty, half-day, punch, leave, weekly off or paid holiday at ANY site breaks the streak.
CREATE OR REPLACE FUNCTION public.guard_absence_streak(_candidate uuid, _from date, _through date)
RETURNS TABLE(streak_start date, absent_days integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH app AS (
   SELECT min(p.punch_date) first_punch FROM public.self_attendance_punches p
   WHERE p.candidate_id=_candidate AND p.check_in_at IS NOT NULL
 ), days AS (
   SELECT d::date dt FROM generate_series(_from::timestamp,_through::timestamp,interval '1 day') d
 ), classified AS (
   SELECT dt,
    EXISTS (SELECT 1 FROM public.candidates c JOIN public.units u ON u.id=c.unit_id
     WHERE c.id=_candidate AND u.status='active'
     UNION ALL SELECT 1 FROM public.candidate_units cu JOIN public.units u ON u.id=cu.unit_id
     WHERE cu.candidate_id=_candidate AND u.status='active' AND cu.created_at::date<=dt) assigned,
    EXISTS (SELECT 1 FROM public.attendance_entries a LEFT JOIN public.attendance_codes ac ON ac.code=a.code
     WHERE a.candidate_id=_candidate AND a.entry_date=dt AND
     (coalesce(a.ot_hours,0)>0 OR coalesce(ac.counts_as_present,false) OR coalesce(ac.is_leave,false)
      OR a.code IN ('W','WO','PH','PH_1.5') OR coalesce(a.code,'') NOT IN ('','A')))
    OR EXISTS (SELECT 1 FROM public.self_attendance_punches p WHERE p.candidate_id=_candidate AND p.punch_date=dt AND p.check_in_at IS NOT NULL) safe,
    EXISTS (SELECT 1 FROM public.attendance_entries a WHERE a.candidate_id=_candidate AND a.entry_date=dt AND a.code='A') marked_absent,
    (SELECT first_punch FROM app) IS NOT NULL AND dt>=(SELECT first_punch FROM app) uses_app
   FROM days
 ), last_break AS (SELECT max(dt) dt FROM classified WHERE safe OR NOT assigned OR NOT (marked_absent OR uses_app))
 SELECT min(c.dt),count(*)::integer FROM classified c CROSS JOIN last_break b
 WHERE c.dt>coalesce(b.dt,_from-1);
$$;
REVOKE ALL ON FUNCTION public.guard_absence_streak(uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_absence_streak(uuid,date,date) TO service_role;

CREATE FUNCTION public.guard_absence_access_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS (SELECT 1 FROM public.guard_absence_access_blocks b
 WHERE b.user_id=auth.uid() AND b.revoked_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.guard_absence_access_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guard_absence_access_allowed() TO authenticated;

CREATE FUNCTION public.send_guard_absence_notice(_case public.guard_absence_cases,_milestone integer,_terminated boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.candidates; uid uuid; target uuid; msg text;
BEGIN
 SELECT * INTO c FROM public.candidates WHERE id=_case.candidate_id;
 msg:=CASE WHEN _terminated THEN 'Termination has been approved. Your system access is disabled. Contact HR for exit details.'
 ELSE 'Absence recorded or attendance missing across assigned sites for '||_case.absent_days||' consecutive days ('||_case.streak_start||' to '||_case.through_date||'). Contact your manager to correct missing attendance or explain absence. Termination requires approval.' END;
 FOR target IN
  SELECT c.id UNION SELECT c.reports_to WHERE c.reports_to IS NOT NULL
  UNION SELECT m.manager_id FROM public.candidate_reporting_managers m WHERE m.candidate_id=c.id
  UNION SELECT ca.id FROM public.candidates ca WHERE ca.is_enabled AND ca.status IN ('active','approved') AND EXISTS
   (SELECT 1 FROM public.workflow_steps s JOIN public.workflow_definitions w ON w.id=s.workflow_id
    WHERE w.key='guard_absence_termination' AND w.is_active AND public.workflow_step_matches(s.id,ca.id))
 LOOP
  uid:=public.get_user_id_by_candidate_id(target);
  IF uid IS NOT NULL THEN
   INSERT INTO public.notifications(user_id,type,title,message,link,entity_type,entity_id)
   VALUES(uid,CASE WHEN _terminated THEN 'guard_absence_terminated' ELSE 'guard_absence_warning' END,
    CASE WHEN _terminated THEN 'Termination approved — ' ELSE 'Absence review — ' END||c.full_name,msg,
    CASE WHEN target=c.id THEN '/admin/employee-dashboard' ELSE '/admin/notifications' END,
    'guard_absence_case',_case.id::text);
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.send_guard_absence_notice(public.guard_absence_cases,integer,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.run_guard_absence_check() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.guard_absence_policy; c record; s record; cs public.guard_absence_cases; d integer; req uuid; n integer:=0;
 yesterday date:=(now() AT TIME ZONE 'Asia/Kolkata')::date-1;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('guard-absence-check')) THEN RETURN 0; END IF;
 SELECT * INTO p FROM public.guard_absence_policy WHERE id;
 IF NOT FOUND OR NOT p.enabled OR p.activated_on IS NULL THEN RETURN 0; END IF;
 FOR c IN SELECT id,full_name,preferred_joining_date,created_at,approved_at FROM public.candidates
  WHERE is_enabled AND status IN ('active','approved') AND role_key=ANY(p.role_keys)
  AND (cardinality(p.department_ids)=0 OR department_id=ANY(p.department_ids)) ORDER BY id
 LOOP
  SELECT * INTO s FROM public.guard_absence_streak(c.id,
   greatest(p.activated_on,coalesce(c.preferred_joining_date,c.approved_at::date,c.created_at::date),yesterday-364),yesterday);
  FOR cs IN SELECT * FROM public.guard_absence_cases WHERE candidate_id=c.id AND status IN ('warning','pending') AND streak_start IS DISTINCT FROM s.streak_start FOR UPDATE LOOP
   IF cs.approval_request_id IS NOT NULL THEN
    UPDATE public.approval_requests SET status='cancelled',decision_note='Attendance changed or employee returned; absence streak ended',decided_at=now(),updated_at=now()
     WHERE id=cs.approval_request_id AND status='pending';
    INSERT INTO public.approval_request_events(request_id,action,note) VALUES(cs.approval_request_id,'cancelled','Absence streak ended');
   END IF;
   UPDATE public.guard_absence_cases SET status='resolved',updated_at=now() WHERE id=cs.id;
  END LOOP;
  IF s.absent_days=0 THEN CONTINUE; END IF;
  IF s.absent_days<least((select min(x) from unnest(p.warning_days) x),p.termination_days) THEN CONTINUE; END IF;
  INSERT INTO public.guard_absence_cases(candidate_id,streak_start,through_date,absent_days)
   VALUES(c.id,s.streak_start,yesterday,s.absent_days)
   ON CONFLICT(candidate_id,streak_start) DO UPDATE SET through_date=excluded.through_date,absent_days=excluded.absent_days,updated_at=now()
   RETURNING * INTO cs;
  IF p.alerts_enabled THEN
   FOR d IN SELECT DISTINCT x FROM unnest(p.warning_days) x WHERE x<=s.absent_days LOOP
    INSERT INTO public.guard_absence_alerts(case_id,milestone) VALUES(cs.id,d) ON CONFLICT DO NOTHING;
    IF FOUND THEN PERFORM public.send_guard_absence_notice(cs,d); END IF;
   END LOOP;
  END IF;
  IF p.termination_enabled AND s.absent_days>=p.termination_days AND cs.status='warning'
   AND public.approval_first_step('guard_absence_termination') IS NOT NULL THEN
   req:=public.approval_create('guard_absence_termination','candidate',c.id,'Review absence termination — '||c.full_name,
    jsonb_build_object('absence_case_id',cs.id,'streak_start',s.streak_start,'through_date',yesterday,'absent_days',s.absent_days,
      'changes',jsonb_build_object('status',jsonb_build_object('from','active','to','inactive'),'is_enabled',jsonb_build_object('from',true,'to',false))),
    'Review attendance at all sites, approved leave and employee explanation before approving. Missing attendance is not proof of misconduct.');
   UPDATE public.guard_absence_cases SET status='pending',approval_request_id=req,updated_at=now() WHERE id=cs.id;
  END IF;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.run_guard_absence_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_guard_absence_check() TO service_role;

-- Final approval is the ONLY exit transition. Recheck all-site attendance at decision time.
CREATE FUNCTION public.apply_guard_absence_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cs public.guard_absence_cases; p public.guard_absence_policy; s record; c public.candidates;
BEGIN
 IF NEW.workflow_key<>'guard_absence_termination' OR OLD.status=NEW.status THEN RETURN NEW; END IF;
 SELECT * INTO cs FROM public.guard_absence_cases WHERE approval_request_id=NEW.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Absence case not found'; END IF;
 IF NEW.status IN ('rejected','cancelled') THEN
  UPDATE public.guard_absence_cases SET status=NEW.status,updated_at=now() WHERE id=cs.id; RETURN NEW;
 END IF;
 IF NEW.status<>'approved' THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.guard_absence_policy WHERE id;
 SELECT * INTO c FROM public.candidates WHERE id=cs.candidate_id FOR UPDATE;
 IF NOT p.enabled OR NOT p.termination_enabled OR NOT c.is_enabled OR c.status NOT IN ('active','approved')
  OR NOT c.role_key=ANY(p.role_keys) OR (cardinality(p.department_ids)>0 AND NOT c.department_id=ANY(p.department_ids)) THEN
  RAISE EXCEPTION 'Policy disabled or employee no longer eligible';
 END IF;
 SELECT * INTO s FROM public.guard_absence_streak(c.id,greatest(p.activated_on,coalesce(c.preferred_joining_date,c.approved_at::date,c.created_at::date),(now() AT TIME ZONE 'Asia/Kolkata')::date-365),
  (now() AT TIME ZONE 'Asia/Kolkata')::date-1);
 IF s.streak_start IS DISTINCT FROM cs.streak_start OR s.absent_days<p.termination_days THEN RAISE EXCEPTION 'Absence changed; termination cannot be approved'; END IF;
 UPDATE public.candidates SET status='inactive',is_enabled=false,offboarded_at=now(),
  offboarding_details=coalesce(offboarding_details,'{}')||jsonb_build_object('reason_text','Continuous absence — approved termination',
   'date_of_offboarding',(now() AT TIME ZONE 'Asia/Kolkata')::date,
   'absence_case_id',cs.id,'approval_request_id',NEW.id,'termination_approved_by',NEW.decided_by,
   'collection_status',CASE WHEN cardinality(coalesce(assigned_asset_ids,'{}'))>0 THEN 'pending' ELSE 'complete' END)
 WHERE id=c.id;
 INSERT INTO public.guard_absence_access_blocks(candidate_id,user_id,case_id) VALUES(c.id,public.get_user_id_by_candidate_id(c.id),cs.id)
 ON CONFLICT(candidate_id) DO UPDATE SET user_id=excluded.user_id,case_id=excluded.case_id,blocked_at=now(),revoked_at=NULL;
 UPDATE public.guard_absence_cases SET status='terminated',absent_days=s.absent_days,updated_at=now() WHERE id=cs.id RETURNING * INTO cs;
 PERFORM public.send_guard_absence_notice(cs,s.absent_days,true);
 RETURN NEW;
END $$;
CREATE TRIGGER apply_guard_absence_approval AFTER UPDATE OF status ON public.approval_requests
 FOR EACH ROW EXECUTE FUNCTION public.apply_guard_absence_approval();

CREATE FUNCTION public.release_guard_absence_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_enabled AND NEW.status IN ('active','approved') AND (NOT OLD.is_enabled OR OLD.status='inactive') THEN
  UPDATE public.guard_absence_access_blocks SET revoked_at=now() WHERE candidate_id=NEW.id AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER release_guard_absence_block AFTER UPDATE OF status,is_enabled ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.release_guard_absence_block();

-- Existing permissive policies cannot let an already-issued JWT bypass an approved block.
-- Restrictive policies preserve every existing scope rule and deny only blocked identities.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN
  ('guard_absence_access_blocks','guard_absence_policy','guard_absence_cases','guard_absence_alerts') LOOP
  EXECUTE format('CREATE POLICY guard_absence_access_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.guard_absence_access_allowed())) WITH CHECK ((select public.guard_absence_access_allowed()))',t.tablename);
 END LOOP;
END $$;

-- Default OFF; no historical evaluation or real employee termination on installation.
INSERT INTO public.guard_absence_policy(id) VALUES(true);
INSERT INTO public.workflow_definitions(key,name,description,entity_type,route_path,is_active)
 VALUES('guard_absence_termination','Guard Absence Termination','Review all-site attendance and the employee explanation before termination. Configure named people, departments or roles.','candidates','/admin/approvals',false);
-- No invented approvers. Leadership configures steps before activation.
SELECT cron.schedule('guard-absence-check','30 22 * * *','SELECT public.run_guard_absence_check();');