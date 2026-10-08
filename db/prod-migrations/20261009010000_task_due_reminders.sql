ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz, ADD COLUMN IF NOT EXISTS overdue_sent_at timestamptz;
CREATE OR REPLACE FUNCTION public.send_task_due_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tasks; n int := 0;
BEGIN
  FOR t IN SELECT * FROM public.tasks WHERE status IN ('open','acknowledged','extension_requested') AND due_at IS NOT NULL
      AND reminder_sent_at IS NULL AND due_at > now() AND due_at <= now() + interval '2 hours' LOOP
    PERFORM public.task_notify(t.assignee_id, t, 'task:due_soon', 'Due soon: ' || t.title,
      'This task is due at ' || to_char(t.due_at AT TIME ZONE 'Asia/Kolkata','DD Mon, HH12:MI AM'));
    UPDATE public.tasks SET reminder_sent_at = now() WHERE id = t.id; n := n+1;
  END LOOP;
  FOR t IN SELECT * FROM public.tasks WHERE status IN ('open','acknowledged','extension_requested') AND due_at IS NOT NULL
      AND overdue_sent_at IS NULL AND due_at <= now() LOOP
    PERFORM public.task_notify(t.assignee_id, t, 'task:overdue', 'Time over: ' || t.title, 'The due time for this task has passed.');
    IF t.created_by IS DISTINCT FROM t.assignee_id THEN
      PERFORM public.task_notify(t.created_by, t, 'task:overdue', 'Overdue: ' || t.title, 'The assignee has not completed this task on time.');
    END IF;
    UPDATE public.tasks SET overdue_sent_at = now(), reminder_sent_at = coalesce(reminder_sent_at, now()) WHERE id = t.id; n := n+1;
  END LOOP;
  RETURN n;
END $$;
-- reset reminders when due date changes
CREATE OR REPLACE FUNCTION public.tasks_reset_reminders() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN NEW.reminder_sent_at := NULL; NEW.overdue_sent_at := NULL; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tasks_reset_reminders ON public.tasks;
CREATE TRIGGER tasks_reset_reminders BEFORE UPDATE OF due_at ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_reset_reminders();
SELECT cron.schedule('task-due-reminders', '*/10 * * * *', 'SELECT public.send_task_due_reminders()');
