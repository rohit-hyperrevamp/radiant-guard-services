-- Every active employee can assign tasks; cases record who filed them.
CREATE OR REPLACE FUNCTION public.current_user_can_assign_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR public.current_user_candidate_id() IS NOT NULL;
$$;

ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS filed_by_id uuid;

-- task_action now stores the previous due date as data.from on request/approve/reopen events (applied in place).
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
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  is_assignee := t.assignee_id = me;
  is_manager := (t.created_by = me AND COALESCE(public.current_user_explicit_permission('tasks','manage','edit'), true)) OR public.current_user_can_manage_tasks();
  IF NOT (is_assignee OR is_manager) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF _action = 'acknowledge' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can acknowledge'; END IF;
    UPDATE public.tasks SET status = CASE WHEN status='open' THEN 'acknowledged' ELSE status END,
      acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now() WHERE id = t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:acknowledged', 'Task acknowledged: ' || t.title, _note);
  ELSIF _action = 'request_extension' THEN
    IF NOT is_assignee THEN RAISE EXCEPTION 'Only the assignee can ask for more time'; END IF;
    IF _until IS NULL OR coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'New date and reason are required'; END IF;
    UPDATE public.tasks SET status='extension_requested', extension_until=_until, extension_reason=_note,
      acknowledged_at = coalesce(acknowledged_at, now()), updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:extension_requested', 'More time requested: ' || t.title,
      'Until ' || to_char(_until AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM') || ' — ' || _note);
  ELSIF _action IN ('approve_extension','reject_extension') THEN
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
    UPDATE public.tasks SET status='completed', completion_note=_note, completed_at=now(),
      proof_paths = proof_paths || coalesce(_paths,'{}'), acknowledged_at = coalesce(acknowledged_at, now()),
      updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.created_by, t, 'task:completed', 'Task completed: ' || t.title, _note);
  ELSIF _action = 'reopen' THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.tasks SET status='open', completed_at=NULL, due_at=coalesce(_until, due_at), updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id, t, 'task:reopen', 'Task reopened: ' || t.title, _note);
  ELSIF _action = 'cancel' THEN
    IF NOT is_manager THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.tasks SET status='cancelled', updated_at=now() WHERE id=t.id;
    PERFORM public.task_notify(t.assignee_id, t, 'task:cancel', 'Task cancelled: ' || t.title, _note);
  ELSIF _action = 'comment' THEN
    NULL;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;

  INSERT INTO public.task_events(task_id, actor_id, kind, note, data)
  VALUES (t.id, me, _action, _note, jsonb_strip_nulls(jsonb_build_object('until', _until, 'paths', _paths, 'from', CASE WHEN _action IN ('request_extension','approve_extension','reopen') THEN t.due_at END)));
END $function$

;
