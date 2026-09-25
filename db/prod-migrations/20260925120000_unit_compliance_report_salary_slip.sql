ALTER TABLE public.units ADD COLUMN IF NOT EXISTS compliance_report_format text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS salary_slip_required boolean;
COMMENT ON COLUMN public.units.compliance_report_format IS 'MAPPINGS: hard_copy | soft_copy | hard_and_soft';
COMMENT ON COLUMN public.units.salary_slip_required IS 'MAPPINGS: whether salary slip must be sent';
