ALTER TABLE public.employee_wages DROP CONSTRAINT IF EXISTS employee_wages_candidate_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS employee_wages_candidate_unit_uidx
  ON public.employee_wages (candidate_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));