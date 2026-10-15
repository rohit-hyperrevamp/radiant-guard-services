-- Formula-based additions: amount worked out per employee at payroll time.
ALTER TABLE public.additions ADD COLUMN IF NOT EXISTS formula_expression text;
