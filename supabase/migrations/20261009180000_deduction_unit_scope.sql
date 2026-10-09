ALTER TABLE public.deductions ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS deductions_unit_id_idx ON public.deductions(unit_id);
COMMENT ON COLUMN public.deductions.unit_id IS 'Optional: when set, deduction applies only in this unit''s payroll; null = any unit.';
