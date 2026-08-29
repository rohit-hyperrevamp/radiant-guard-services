DROP INDEX IF EXISTS public.employee_wages_candidate_unit_uidx;
ALTER TABLE public.employee_wages DROP CONSTRAINT IF EXISTS employee_wages_candidate_id_key;
DELETE FROM public.employee_wages a
USING public.employee_wages b
WHERE a.candidate_id = b.candidate_id
  AND a.unit_id IS NOT DISTINCT FROM b.unit_id
  AND a.ctid > b.ctid;
ALTER TABLE public.employee_wages
  ADD CONSTRAINT employee_wages_candidate_unit_key UNIQUE NULLS NOT DISTINCT (candidate_id, unit_id);