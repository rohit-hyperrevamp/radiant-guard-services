-- Correct only employee 49586's (Belim Vasim) joining year; preserve September 19.
BEGIN;
DO $$
DECLARE saved_date date;
BEGIN
  SELECT preferred_joining_date INTO STRICT saved_date
  FROM public.candidates
  WHERE id = '3deab06d-1004-457c-ab75-639fd0f18090' AND employee_code = '49586'
  FOR UPDATE;
  IF saved_date IS NULL OR saved_date NOT IN (DATE '2026-09-19', DATE '2025-09-19') THEN
    RAISE EXCEPTION 'Unexpected joining date; correction not applied';
  END IF;
  UPDATE public.candidates
  SET preferred_joining_date = DATE '2025-09-19'
  WHERE id = '3deab06d-1004-457c-ab75-639fd0f18090' AND employee_code = '49586'
    AND preferred_joining_date = DATE '2026-09-19';
  IF NOT EXISTS (
    SELECT 1 FROM public.candidates
    WHERE id = '3deab06d-1004-457c-ab75-639fd0f18090' AND employee_code = '49586'
      AND preferred_joining_date = DATE '2025-09-19'
  ) THEN
    RAISE EXCEPTION 'Joining date verification failed';
  END IF;
END $$;
COMMIT;
