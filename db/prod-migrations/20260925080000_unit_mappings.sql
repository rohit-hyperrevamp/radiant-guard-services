-- Client "Mappings" tab: optional administrative attributes per unit.
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS client_type text,
  ADD COLUMN IF NOT EXISTS hr_executive_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mapping_payroll_window_id uuid REFERENCES public.payroll_windows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operations_manager_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_manager_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dividing_factor numeric,
  ADD COLUMN IF NOT EXISTS compliance_frequency text CHECK (compliance_frequency IS NULL OR compliance_frequency IN ('monthly','quarterly'));
NOTIFY pgrst, 'reload schema';
