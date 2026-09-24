-- One person may hold several lines at the same unit: different designation,
-- 8h vs 12h duty, and/or a separate reliever (Extra Duty) line.
BEGIN;

-- 1. Postings: unique per line, not per (candidate, unit)
ALTER TABLE public.candidate_units DROP CONSTRAINT IF EXISTS candidate_units_candidate_id_unit_id_key;
ALTER TABLE public.candidate_units DROP CONSTRAINT IF EXISTS candidate_units_line_key;
ALTER TABLE public.candidate_units ADD CONSTRAINT candidate_units_line_key
  UNIQUE NULLS NOT DISTINCT (candidate_id, unit_id, designation_id, shift_hours, is_reliever);

-- Primary = payroll home unit. Other regular lines at the SAME unit stay
-- regular; only lines at other units become reliever lines.
CREATE OR REPLACE FUNCTION public.enforce_single_primary_unit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_primary THEN
    NEW.is_reliever := false;
    UPDATE public.candidate_units
       SET is_primary = false, is_reliever = true, updated_at = now()
     WHERE candidate_id = NEW.candidate_id AND id <> NEW.id AND is_primary
       AND unit_id <> NEW.unit_id;
    UPDATE public.candidate_units
       SET is_primary = false, updated_at = now()
     WHERE candidate_id = NEW.candidate_id AND id <> NEW.id AND is_primary
       AND unit_id = NEW.unit_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.candidate_units x
    WHERE x.candidate_id = NEW.candidate_id AND x.unit_id = NEW.unit_id
      AND x.id <> NEW.id AND x.is_primary
  ) THEN
    NEW.is_reliever := true;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Attendance entries carry their line
ALTER TABLE public.attendance_entries ADD COLUMN IF NOT EXISTS shift_hours smallint NOT NULL DEFAULT 0;
ALTER TABLE public.attendance_entries ADD COLUMN IF NOT EXISTS is_reliever boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance_entries DROP CONSTRAINT IF EXISTS attendance_entries_shift_hours_chk;
ALTER TABLE public.attendance_entries ADD CONSTRAINT attendance_entries_shift_hours_chk CHECK (shift_hours IN (0,8,12));

ALTER TABLE public.attendance_entries DISABLE TRIGGER USER;
UPDATE public.attendance_entries ae SET is_reliever = true
WHERE EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = ae.candidate_id AND cu.unit_id = ae.unit_id AND cu.is_reliever)
  AND NOT EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = ae.candidate_id AND cu.unit_id = ae.unit_id AND NOT cu.is_reliever)
  AND NOT EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = ae.candidate_id AND c.unit_id = ae.unit_id);
UPDATE public.attendance_entries ae SET shift_hours = cu.shift_hours
FROM public.candidate_units cu
WHERE cu.candidate_id = ae.candidate_id AND cu.unit_id = ae.unit_id AND cu.shift_hours IS NOT NULL;
ALTER TABLE public.attendance_entries ENABLE TRIGGER USER;

ALTER TABLE public.attendance_entries DROP CONSTRAINT IF EXISTS attendance_entries_unit_cand_desig_date_unique;
ALTER TABLE public.attendance_entries ADD CONSTRAINT attendance_entries_unit_cand_desig_date_unique
  UNIQUE NULLS NOT DISTINCT (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date);

-- 3. Reliever rule reads the line; legacy writers without the flag get it
--    inferred from the postings.
CREATE OR REPLACE FUNCTION public.enforce_reliever_extra_duty_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;
DROP TRIGGER IF EXISTS attendance_entries_reliever_ed_only ON public.attendance_entries;
CREATE TRIGGER attendance_entries_reliever_ed_only BEFORE INSERT OR UPDATE OF candidate_id, unit_id, code, is_reliever
  ON public.attendance_entries FOR EACH ROW EXECUTE FUNCTION public.enforce_reliever_extra_duty_only();

-- 4. Functions that upsert attendance use the new line key
DO $$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['autofill_daily_attendance','enforce_contract_present_day_limit'] LOOP
    SELECT pg_get_functiondef(('public.'||f)::regproc) INTO d;
    d := replace(d, 'ON CONFLICT (unit_id, candidate_id, designation_id, entry_date)',
                    'ON CONFLICT (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date)');
    IF f = 'enforce_contract_present_day_limit' THEN
      d := replace(d, 'AND ae.designation_id IS NOT DISTINCT FROM NEW.designation_id',
                      'AND ae.designation_id IS NOT DISTINCT FROM NEW.designation_id AND ae.shift_hours = NEW.shift_hours AND ae.is_reliever = NEW.is_reliever');
      d := replace(d, 'AND ae.designation_id IS NOT DISTINCT FROM OLD.designation_id',
                      'AND ae.designation_id IS NOT DISTINCT FROM OLD.designation_id AND ae.shift_hours = OLD.shift_hours AND ae.is_reliever = OLD.is_reliever');
      d := replace(d, 'INSERT INTO public.attendance_entries (unit_id, candidate_id, designation_id, entry_date, code, ot_hours)',
                      'INSERT INTO public.attendance_entries (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours)');
      d := replace(d, 'VALUES (NEW.unit_id, NEW.candidate_id, NEW.designation_id, v_target,',
                      'VALUES (NEW.unit_id, NEW.candidate_id, NEW.designation_id, NEW.shift_hours, NEW.is_reliever, v_target,');
    END IF;
    EXECUTE d;
  END LOOP;
END $$;

COMMIT;
