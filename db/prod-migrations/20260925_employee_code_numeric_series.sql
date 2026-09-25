CREATE OR REPLACE FUNCTION public.set_employee_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _next bigint;
BEGIN
  IF NEW.status IN ('approved','active') AND (NEW.employee_code IS NULL OR NEW.employee_code = '') THEN
    PERFORM pg_advisory_xact_lock(hashtext('candidates_employee_code'));
    SELECT COALESCE(MAX(employee_code::bigint), 0) + 1 INTO _next
      FROM public.candidates
     WHERE employee_code ~ '^[0-9]{1,6}$';
    NEW.employee_code := _next::text;
    IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
  END IF;
  IF NEW.status = 'rejected' AND NEW.rejected_at IS NULL THEN NEW.rejected_at := now(); END IF;
  RETURN NEW;
END; $$;

-- Renumber the two attendance-upload employees into the numeric series
UPDATE public.candidates SET employee_code = '49475' WHERE id = 'e44d4e91-e158-4f72-889f-0f10132ae2dc' AND employee_code = 'EMP-109';
UPDATE public.candidates SET employee_code = '49476' WHERE employee_code = 'EMP-110' AND full_name = 'Ashish chavhan';
