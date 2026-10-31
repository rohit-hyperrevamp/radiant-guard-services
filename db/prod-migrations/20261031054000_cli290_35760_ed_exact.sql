-- CLI290 employee 35760: 57.5 Extra Duty hours ÷ 8 = 7.1875 days. The 2 Sep
-- entry was saved as 0.188 (3-decimal rounding); store the exact 0.1875.
CREATE TABLE IF NOT EXISTS public.backup_attendance_cli290_35760_20261031 AS
  SELECT * FROM public.attendance_entries
  WHERE unit_id = '65cf3174-4fbb-40ab-84a6-20d315440c2a'
    AND candidate_id = '20e4b468-2345-4e27-aa1b-48f0f90170a4'
    AND entry_date = '2026-09-02';
UPDATE public.attendance_entries SET ot_hours = 0.1875
WHERE unit_id = '65cf3174-4fbb-40ab-84a6-20d315440c2a'
  AND candidate_id = '20e4b468-2345-4e27-aa1b-48f0f90170a4'
  AND entry_date = '2026-09-02' AND ot_hours = 0.188;
