-- MIS formats can print one row per employee (manpower-wise) or one row per
-- client site (billing annexure, e.g. Bajaj Financial Securities).
ALTER TABLE public.mis_templates
  ADD COLUMN IF NOT EXISTS row_grain text NOT NULL DEFAULT 'employee';

ALTER TABLE public.mis_templates
  DROP CONSTRAINT IF EXISTS mis_templates_row_grain_check;
ALTER TABLE public.mis_templates
  ADD CONSTRAINT mis_templates_row_grain_check CHECK (row_grain IN ('employee', 'site'));
