-- One task campaign groups independent employee assignments. Existing IDs, proof paths and audit events stay intact.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignment_group_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_submitted';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
UPDATE public.tasks SET assignment_group_id=id WHERE assignment_group_id IS NULL;
UPDATE public.tasks SET review_status='accepted' WHERE status='completed' AND review_status='not_submitted';
CREATE INDEX IF NOT EXISTS tasks_assignment_group_idx ON public.tasks(assignment_group_id,assignee_id);
-- Lifecycle changes and deletion must not bypass the durable action/event boundary.
REVOKE UPDATE, DELETE ON public.tasks FROM authenticated;
CREATE OR REPLACE FUNCTION public.task_action(_task_id uuid, _action text, _note text DEFAULT NULL::text, _until timestamp with time zone DEFAULT NULL::timestamp with time zone, _paths text[] DEFAULT NULL::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks; me uuid := public.current_user_candidate_id();
  is_assignee boolean; is_manager boolean;
BEGIN
  IF auth.uid() IS NULL OR me IS NULL OR NOT public.guard_absence_access_allowed() THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  is_assignee := t.assignee_id = me;
  is_manager := (t.created_by = me AND COALESCE(public.current_user_explicit_permission('tasks','manage','edit'), true)) OR public.current_user_can_manage_tasks();
  IF NOT (is_assignee OR is_manager) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF _action IN ('acknowledge','request_extension','complete','approve_extension','reject_extension') AND t.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This task is not open'; END IF;
  IF _action = 'acknowledge' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can acknowledge'; END IF;
    UPDATE public.tasks SET status = CASE WHEN status='open' THEN 'acknowledged' ELSE status END,
      acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now() WHERE id = t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:acknowledged', 'Task acknowledged: ' || t.title, _note);
  ELSIF _action = 'request_extension' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can ask for more time'; END IF;
    IF _until IS NULL OR _until <= now() OR coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'New date and reason are required'; END IF;
    UPDATE public.tasks SET status='extension_requested', extension_until=_until, extension_reason=_note,
      acknowledged_at = coalesce(acknowledged_at, now()), updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:extension_requested', 'More time requested: ' || t.title,
      'Until ' || to_char(_until AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM') || ' — ' || _note);
  ELSIF _action IN ('approve_extension','reject_extension') THEN
    IF _action = 'approve_extension' AND coalesce(_until,t.extension_until) <= now() THEN RAISE EXCEPTION 'Choose a future deadline'; END IF;
    IF _action = 'reject_extension' AND t.status <> 'extension_requested' THEN RAISE EXCEPTION 'No extension to reject'; END IF;
    IF NOT is_manager THEN RAISE EXCEPTION 'Only the task creator or leadership can decide'; END IF;
    IF _action = 'approve_extension' THEN
      UPDATE public.tasks SET due_at = coalesce(_until, extension_until, due_at), status='acknowledged',
        extension_until=NULL, updated_at=now() WHERE id=t.id;
      PERFORM public.task_notify(t.assignee_id, t, 'task:extension_approved', 'New due date: ' || t.title,
        to_char(coalesce(_until, t.extension_until) AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM'));
    ELSE
      UPDATE public.tasks SET status='acknowledged', extension_until=NULL, updated_at=now() WHERE id=t.id;
      PERFORM public.task_notify(t.assignee_id, t, 'task:extension_rejected', 'More time not approved: ' || t.title, _note);
    END IF;
  ELSIF _action = 'complete' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can complete'; END IF;
    IF coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'Please write a note'; END IF;
    UPDATE public.tasks SET status='completed', review_status='pending', reviewed_at=NULL, completion_note=_note, completed_at=now(),
      proof_paths = proof_paths || coalesce(_paths,'{}'), acknowledged_at = coalesce(acknowledged_at, now()),
      updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:submitted', 'Task submitted for review: ' || t.title, _note);
  ELSIF _action = 'accept' THEN
    IF NOT is_manager OR t.status <> 'completed' OR t.review_status <> 'pending' THEN RAISE EXCEPTION 'Only the reviewer can accept submitted work'; END IF;
    UPDATE public.tasks SET review_status='accepted', reviewed_at=now(), updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id,t,'task:accepted','Task accepted: ' || t.title,_note);
  ELSIF _action = 'reopen' THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF t.status <> 'completed' THEN RAISE EXCEPTION 'Only submitted or completed work can be returned'; END IF;
    IF coalesce(trim(_note),'') = '' OR _until IS NULL OR _until <= now() THEN RAISE EXCEPTION 'Feedback and a future date/time are required'; END IF;
    UPDATE public.tasks SET status='open', review_status='returned', feedback=_note, reviewed_at=now(), completed_at=NULL, acknowledged_at=NULL, extension_until=NULL, due_at=_until, updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id, t, 'task:reopen', 'Task reopened: ' || t.title, _note);
  ELSIF _action = 'cancel' THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.tasks SET status='cancelled', updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id, t, 'task:cancel', 'Task cancelled: ' || t.title, _note);
  ELSIF _action = 'comment' THEN
    NULL;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;

  INSERT INTO public.task_events(task_id, actor_id, kind, note, data)
  VALUES (t.id, me, _action, _note, jsonb_strip_nulls(jsonb_build_object('actor_name',(select full_name from candidates where id=me),'until', _until, 'paths', _paths, 'previous_status',t.status,'previous_review',t.review_status, 'from', CASE WHEN _action IN ('request_extension','approve_extension','reopen') THEN t.due_at END)));
END $function$

;

CREATE OR REPLACE FUNCTION public.task_recipient_directory(_departments uuid[] DEFAULT '{}', _page integer DEFAULT 0)
RETURNS TABLE(id uuid,full_name text,employee_code text,department_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT c.id,c.full_name,c.employee_code,c.department_id FROM candidates c
WHERE (select auth.uid()) IS NOT NULL AND (select guard_absence_access_allowed()) AND (select current_user_can_assign_tasks())
AND c.status IN ('active','approved') AND c.is_enabled AND (cardinality(_departments)=0 OR c.department_id=ANY(_departments))
ORDER BY c.full_name,c.id LIMIT 500 OFFSET greatest(_page,0)*500;
$$;
CREATE OR REPLACE FUNCTION public.create_task_group(_title text,_description text,_departments uuid[],_employees uuid[],_due_at timestamptz,_priority text DEFAULT 'medium')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=current_user_candidate_id(); gid uuid:=gen_random_uuid(); expected integer;
BEGIN
 IF auth.uid() IS NULL OR me IS NULL OR NOT current_user_can_assign_tasks() OR NOT guard_absence_access_allowed() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 IF coalesce(trim(_title),'')='' THEN RAISE EXCEPTION 'Task title required'; END IF;
 SELECT count(DISTINCT e) INTO expected FROM unnest(_employees) e;
 IF expected=0 THEN RAISE EXCEPTION 'Select at least one employee'; END IF;
 IF (SELECT count(*) FROM candidates c WHERE c.id=ANY(_employees) AND c.is_enabled AND c.status IN ('active','approved') AND (cardinality(_departments)=0 OR c.department_id=ANY(_departments))) <> expected THEN RAISE EXCEPTION 'A selected employee is unavailable or outside the selected departments'; END IF;
 INSERT INTO tasks(title,description,created_by,assignee_id,department_id,due_at,priority,assignment_group_id)
 SELECT trim(_title),coalesce(_description,''),me,c.id,c.department_id,_due_at,_priority,gid FROM candidates c WHERE c.id=ANY(_employees);
 RETURN gid;
END $$;
CREATE OR REPLACE FUNCTION public.task_summary_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH source AS MATERIALIZED (SELECT * FROM tasks WHERE (select auth.uid()) IS NOT NULL), mine AS (
SELECT id,status,review_status,due_at,acknowledged_at FROM source WHERE assignee_id=(select current_user_candidate_id())
), created AS (
SELECT coalesce(assignment_group_id,id) gid,bool_or(status NOT IN ('completed','cancelled') OR review_status='pending') pending,
bool_or(status='completed' AND review_status='pending') review,bool_and(status IN ('completed','cancelled') AND review_status<>'pending') finished,
bool_or(status='completed') any_complete,bool_or(status='open' AND acknowledged_at IS NULL) no_reply,
bool_or(status NOT IN ('completed','cancelled') AND due_at<now()) overdue
FROM source WHERE created_by=(select current_user_candidate_id()) GROUP BY coalesce(assignment_group_id,id)
)
SELECT jsonb_build_object('mine',jsonb_build_object('total',(select count(*) from mine),'open',(select count(*) from mine where status NOT IN ('completed','cancelled') OR review_status='pending'), 'completed',(select count(*) from mine where status='completed' AND review_status='accepted'),'review',(select count(*) from mine where review_status='pending'), 'notResponded',(select count(*) from mine where status='open' AND acknowledged_at IS NULL),'overdue',(select count(*) from mine where status NOT IN ('completed','cancelled') AND due_at<now())),
'created',jsonb_build_object('total',(select count(*) from created),'open',(select count(*) from created where pending),'completed',(select count(*) from created where finished AND any_complete),'review',(select count(*) from created where review),'notResponded',(select count(*) from created where no_reply),'overdue',(select count(*) from created where overdue)));
$$;
REVOKE ALL ON FUNCTION public.task_action(uuid,text,text,timestamptz,text[]),public.create_task_group(text,text,uuid[],uuid[],timestamptz,text),public.task_recipient_directory(uuid[],integer),public.task_summary_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.task_action(uuid,text,text,timestamptz,text[]),public.create_task_group(text,text,uuid[],uuid[],timestamptz,text),public.task_recipient_directory(uuid[],integer),public.task_summary_counts() TO authenticated;
NOTIFY pgrst,'reload schema';
