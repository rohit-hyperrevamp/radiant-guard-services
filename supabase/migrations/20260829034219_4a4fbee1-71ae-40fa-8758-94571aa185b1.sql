ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.employee_wages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  designation_id uuid REFERENCES public.designations(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  shift_hours integer NOT NULL DEFAULT 8,
  payroll_day_base_id uuid REFERENCES public.payroll_day_bases(id) ON DELETE SET NULL,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
  employer_contributions jsonb NOT NULL DEFAULT '[]'::jsonb,
  gross numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_wages TO authenticated;
GRANT ALL ON public.employee_wages TO service_role;

ALTER TABLE public.employee_wages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view employee wages"
  ON public.employee_wages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert employee wages"
  ON public.employee_wages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update employee wages"
  ON public.employee_wages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete employee wages"
  ON public.employee_wages FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS employee_wages_unit_idx ON public.employee_wages(unit_id);

CREATE TRIGGER employee_wages_set_updated_at
  BEFORE UPDATE ON public.employee_wages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();