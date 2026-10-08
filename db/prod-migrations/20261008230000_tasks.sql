-- Task assignment: heads/leadership/legal/reporting managers assign tasks; assignee acknowledges,
-- asks for more time, uploads proof and completes. All state changes go through RPCs.
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.candidates(id),
  assignee_id uuid NOT NULL REFERENCES public.candidates(id),
  department_id uuid,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','extension_requested','completed','cancelled')),
  acknowledged_at timestamptz,
  extension_until timestamptz,
  extension_reason text,
  completion_note text,
  proof_paths text[] NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON public.tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS tasks_creator_idx ON public.tasks(created_by, status);

CREATE TABLE IF NOT EXISTS public.task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  note text,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_events_task_idx ON public.task_events(task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT ON public.task_events TO authenticated;
GRANT ALL ON public.tasks, public.task_events TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

-- Overseers: admin/super admin, leadership role, or Leadership department.
CREATE OR REPLACE FUNCTION public.current_user_is_task_overseer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR EXISTS (
    SELECT 1 FROM public.candidates c LEFT JOIN public.departments d ON d.id = c.department_id
    WHERE c.mobile = public.current_user_mobile()
      AND (c.role_key IN ('leadership','super_admin','admin') OR d.name = 'Leadership'));
$$;

-- Assigners: overseers, Legal department, or anyone with direct reports.
CREATE OR REPLACE FUNCTION public.current_user_can_assign_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.current_user_is_task_overseer() OR EXISTS (
    SELECT 1 FROM public.candidates c LEFT JOIN public.departments d ON d.id = c.department_id
    WHERE c.mobile = public.current_user_mobile()
      AND (d.name = 'Legal'
        OR EXISTS (SELECT 1 FROM public.candidates r WHERE r.reports_to = c.id AND r.status IN ('active','approved'))
        OR EXISTS (SELECT 1 FROM public.candidate_reporting_managers m WHERE m.manager_id = c.id)));
$$;
GRANT EXECUTE ON FUNCTION public.current_user_is_task_overseer(), public.current_user_can_assign_tasks() TO authenticated;

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (
  created_by = (SELECT public.current_user_candidate_id()) OR assignee_id = (SELECT public.current_user_candidate_id())
  OR (SELECT public.current_user_is_task_overseer()));
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.current_user_can_assign_tasks())
  AND (created_by = (SELECT public.current_user_candidate_id()) OR (SELECT public.current_user_is_task_overseer())));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (
  created_by = (SELECT public.current_user_candidate_id()) OR (SELECT public.current_user_is_task_overseer()));
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (
  created_by = (SELECT public.current_user_candidate_id()) OR (SELECT public.current_user_is_task_overseer()));
CREATE POLICY task_events_select ON public.task_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));

-- Notify helper
CREATE OR REPLACE FUNCTION public.task_notify(_candidate uuid, _task public.tasks, _type text, _title text, _msg text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := public.get_user_id_by_candidate(_candidate);
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(id, user_id, actor_id, type, title, message, link, entity_type, entity_id)
  VALUES (gen_random_uuid(), _uid, auth.uid(), _type, _title, coalesce(_msg,''), '/admin/tasks?task=' || _task.id, 'task', _task.id::text);
END $$;

-- On create: event + notify assignee
CREATE OR REPLACE FUNCTION public.tasks_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.task_events(task_id, actor_id, kind, note, data)
  VALUES (NEW.id, NEW.created_by, 'created', NEW.description, jsonb_build_object('due_at', NEW.due_at));
  PERFORM public.task_notify(NEW.assignee_id, NEW, 'task:assigned', 'New task: ' || NEW.title,
    coalesce('Due ' || to_char(NEW.due_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM'), 'No due date'));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tasks_after_insert ON public.tasks;
CREATE TRIGGER tasks_after_insert AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_after_insert();

-- Single action RPC
CREATE OR REPLACE FUNCTION public.task_action(_task_id uuid, _action text, _note text DEFAULT NULL,
  _until timestamptz DEFAULT NULL, _paths text[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t public.tasks; me uuid := public.current_user_candidate_id();
  is_assignee boolean; is_manager boolean;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  is_assignee := t.assignee_id = me;
  is_manager := t.created_by = me OR public.current_user_is_task_overseer();
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
  VALUES (t.id, me, _action, _note, jsonb_strip_nulls(jsonb_build_object('until', _until, 'paths', _paths)));
END $$;
GRANT EXECUTE ON FUNCTION public.task_action(uuid, text, text, timestamptz, text[]) TO authenticated;

-- Private proof files: task-proofs/<task_id>/<file>
INSERT INTO storage.buckets (id, name, public) VALUES ('task-proofs','task-proofs', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS task_proofs_read ON storage.objects;
CREATE POLICY task_proofs_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'task-proofs' AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id::text = split_part(name,'/',1)));
DROP POLICY IF EXISTS task_proofs_write ON storage.objects;
CREATE POLICY task_proofs_write ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'task-proofs' AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id::text = split_part(name,'/',1)
    AND t.assignee_id = (SELECT public.current_user_candidate_id())));
