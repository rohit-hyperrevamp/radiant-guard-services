-- Mappings tab: Payroll Manager and Compliance Manager (both HR-role employees)
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS payroll_manager_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_manager_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';