-- Person-specific allowances: site scope, monthly repeat with end date,
-- pay by days, and PF/ESI eligibility per allowance.
ALTER TABLE public.additions
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repeat_monthly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS prorate_by_days boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS counts_for_pf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS counts_for_esi boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS additions_unit_idx ON public.additions(unit_id);
