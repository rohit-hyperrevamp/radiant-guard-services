-- Allow the new annual-average method on payroll_day_bases.
ALTER TABLE public.payroll_day_bases
  DROP CONSTRAINT IF EXISTS payroll_day_bases_method_check;

ALTER TABLE public.payroll_day_bases
  ADD CONSTRAINT payroll_day_bases_method_check
  CHECK (method IN ('actual_days','fixed_days','actual_minus_weekly_off','custom_weekdays','fixed_annual_average'));

-- Add the pre-built 30.41-day rule.
INSERT INTO public.payroll_day_bases (
  name,
  code,
  method,
  fixed_days,
  weekly_off_day,
  description,
  is_default,
  enabled,
  sort_order
) VALUES (
  'Fixed 30.41 Days',
  'FIXED_30_41',
  'fixed_annual_average',
  NULL,
  NULL,
  'Salary is divided by the annual average of 30.41 days (365 ÷ 12) for every month, used primarily for invoicing.',
  false,
  true,
  4
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  method = EXCLUDED.method,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();