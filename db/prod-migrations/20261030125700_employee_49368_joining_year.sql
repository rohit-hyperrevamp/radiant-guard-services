-- Correct only employee 49368's joining year; preserve September 5.
BEGIN;
DO $$
DECLARE saved_date date;
BEGIN
  SELECT preferred_joining_date INTO STRICT saved_date
  FROM public.candidates
  WHERE id = '0e7a0434-e245-4ac8-9fcd-0ab2d60d2408' AND employee_code = '49368'
  FOR UPDATE;
  IF saved_date NOT IN (DATE '2026-09-05', DATE '2025-09-05') OR saved_date IS NULL THEN
    RAISE EXCEPTION 'Unexpected joining date; correction not applied';
  END IF;
  UPDATE public.candidates
  SET preferred_joining_date = DATE '2025-09-05'
  WHERE id = '0e7a0434-e245-4ac8-9fcd-0ab2d60d2408' AND employee_code = '49368'
    AND preferred_joining_date = DATE '2026-09-05';
  IF NOT EXISTS (
    SELECT 1 FROM public.candidates
    WHERE id = '0e7a0434-e245-4ac8-9fcd-0ab2d60d2408' AND employee_code = '49368'
      AND preferred_joining_date = DATE '2025-09-05'
  ) THEN
    RAISE EXCEPTION 'Joining date verification failed';
  END IF;
END $$;
COMMIT;