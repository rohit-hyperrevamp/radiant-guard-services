-- Extra Duty created by the payroll-day limit belongs to the guard's own line.
-- The reliever check was flipping those moved rows to "reliever" when the guard
-- had no primary posting row, which split one guard's month into two lines.
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_reliever_extra_duty_only'::regproc) INTO d;
  IF position('NOT NEW.ed_from_cap' IN d) = 0 THEN
    d := replace(d, 'IF TG_OP = ''INSERT'' AND NOT NEW.is_reliever THEN', 'IF TG_OP = ''INSERT'' AND NOT NEW.is_reliever AND NOT NEW.ed_from_cap THEN');
    EXECUTE d;
  END IF;
END $$;

UPDATE public.attendance_entries ae SET is_reliever = false, updated_at = now()
WHERE ae.is_reliever AND ae.ed_from_cap AND ae.code = '' AND ae.entry_date >= '2026-08-01'
  AND EXISTS (SELECT 1 FROM public.attendance_entries x WHERE x.unit_id = ae.unit_id AND x.candidate_id = ae.candidate_id
              AND NOT x.is_reliever AND x.designation_id IS NOT DISTINCT FROM ae.designation_id
              AND date_trunc('month', x.entry_date) = date_trunc('month', ae.entry_date))
  AND NOT EXISTS (SELECT 1 FROM public.attendance_entries y WHERE y.unit_id = ae.unit_id AND y.candidate_id = ae.candidate_id
              AND NOT y.is_reliever AND y.designation_id IS NOT DISTINCT FROM ae.designation_id AND y.shift_hours = ae.shift_hours
              AND y.entry_date = ae.entry_date)
  AND NOT EXISTS (SELECT 1 FROM public.payroll_runs pr WHERE pr.unit_id = ae.unit_id AND pr.payroll_status = 'processed'
              AND ae.entry_date BETWEEN pr.period_start AND pr.period_end);
