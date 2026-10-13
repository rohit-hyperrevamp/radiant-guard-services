-- Attendance imported from a source system (e.g. Pages Payroll) can say a guard
-- worked regular duty at a site that is not his primary posting. The source is
-- the authority there, so imports set app.attendance_source = 'import' and the
-- automatic "reliever = Extra Duty only" conversion is skipped for that session.
create or replace function public.enforce_reliever_extra_duty_only()
returns trigger language plpgsql as $$
BEGIN
  IF coalesce(current_setting('app.attendance_source', true), '') = 'import' THEN
    IF NEW.is_reliever AND NEW.code <> '' THEN
      RAISE EXCEPTION 'Reliever attendance at this unit must be recorded as Extra Duty';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NOT NEW.is_reliever THEN
    IF NOT EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = NEW.candidate_id AND c.unit_id = NEW.unit_id)
       AND NOT EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = NEW.candidate_id AND cu.unit_id = NEW.unit_id AND NOT cu.is_reliever)
       AND EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = NEW.candidate_id AND cu.unit_id = NEW.unit_id AND cu.is_reliever)
    THEN
      NEW.is_reliever := true;
    END IF;
  END IF;
  IF NEW.is_reliever AND NEW.code <> '' THEN
    RAISE EXCEPTION 'Reliever attendance at this unit must be recorded as Extra Duty';
  END IF;
  RETURN NEW;
END;
$$;
