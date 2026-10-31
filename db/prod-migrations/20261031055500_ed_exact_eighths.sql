-- Extra Duty entered in hours on 8-hour shifts was saved with 3 decimals
-- (3.5 h = 0.4375 d saved 0.438). Restore the exact values.
CREATE TABLE IF NOT EXISTS public.backup_attendance_ed_eighths_20261031 AS
  SELECT e.* FROM public.attendance_entries e JOIN public.units u ON u.id = e.unit_id
  JOIN public.candidates c ON c.id = e.candidate_id
  WHERE (u.code, c.employee_code, e.entry_date) IN
    (('CLI4094','49593','2026-09-26'::date),('CLI2344','44580','2026-08-23'::date),('CLI3077','44720','2026-08-21'::date));
UPDATE public.attendance_entries e SET ot_hours = round(e.ot_hours * 8 * 2) / 16
FROM public.backup_attendance_ed_eighths_20261031 b
WHERE e.id = b.id AND (e.ot_hours * 1000) = round(e.ot_hours * 1000) AND e.ot_hours * 8 <> round(e.ot_hours * 8, 1);
