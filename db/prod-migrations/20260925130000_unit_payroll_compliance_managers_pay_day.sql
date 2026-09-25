ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS payroll_manager_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_manager_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mapping_pay_day smallint CHECK (mapping_pay_day BETWEEN 1 AND 31);
