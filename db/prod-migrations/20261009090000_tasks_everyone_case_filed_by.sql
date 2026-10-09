-- Every active employee can assign tasks; cases record who filed them.
CREATE OR REPLACE FUNCTION public.current_user_can_assign_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin_user() OR public.current_user_candidate_id() IS NOT NULL;
$$;

ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS filed_by_id uuid;

-- Keep old -> new due date on every reschedule so the log shows each change.
CREATE OR REPLACE FUNCTION public.task_events_add_prev_due()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kind IN ('request_extension','approve_extension','reopen','reschedule') THEN
    NEW.data := NEW.data || jsonb_strip_nulls(jsonb_build_object('from', (SELECT due_at FROM public.tasks WHERE id = NEW.task_id)));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS task_events_add_prev_due ON public.task_events;
CREATE TRIGGER task_events_add_prev_due BEFORE INSERT ON public.task_events FOR EACH ROW EXECUTE FUNCTION public.task_events_add_prev_due();
