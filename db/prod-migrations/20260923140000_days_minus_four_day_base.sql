-- "Days Minus Four" day basis for payroll and billing.
--
-- Actual calendar days in the payroll window minus four:
--   31 days -> 27, 30 -> 26, 29 -> 25, 28 -> 24
-- This is the L&T contractual basis, so every active L&T contract resource is
-- switched to it on both the payroll and the billing side.

-- 1. Allow the new method on payroll_day_bases (billing_day_bases has no check).
ALTER TABLE public.payroll_day_bases DROP CONSTRAINT IF EXISTS payroll_day_bases_method_check;
ALTER TABLE public.payroll_day_bases ADD CONSTRAINT payroll_day_bases_method_check
  CHECK (method = ANY (ARRAY[
    'actual_days'::text,
    'fixed_days'::text,
    'actual_minus_weekly_off'::text,
    'custom_weekdays'::text,
    'fixed_annual_average'::text,
    'actual_minus_days'::text
  ]));

-- 2. Master rows.
INSERT INTO public.payroll_day_bases (code, name, method, fixed_days, description, enabled, sort_order)
VALUES ('DAYS_MINUS_4', 'Days Minus Four', 'actual_minus_days', 4,
        'Actual calendar days of the payroll window minus 4 (31→27, 30→26, 29→25, 28→24).', true, 60)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name, method = EXCLUDED.method, fixed_days = EXCLUDED.fixed_days,
      description = EXCLUDED.description, enabled = true;

INSERT INTO public.billing_day_bases (code, name, method, fixed_days, description, enabled, sort_order)
VALUES ('DAYS_MINUS_4', 'Days Minus Four', 'actual_minus_days', 4,
        'Actual calendar days of the billing cycle minus 4 (31→27, 30→26, 29→25, 28→24).', true, 60)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name, method = EXCLUDED.method, fixed_days = EXCLUDED.fixed_days,
      description = EXCLUDED.description, enabled = true;

-- 3. Point every active L&T contract resource at it.
WITH lt AS (
  SELECT r.id
  FROM public.contract_resources r
  JOIN public.client_contracts c ON c.id = r.contract_id
  JOIN public.units u ON u.id = c.unit_id
  JOIN public.customers cu ON cu.id = u.customer_id
  WHERE c.status = 'active'
    AND cu.name ILIKE '%L&T%'
)
UPDATE public.contract_resources r
SET payroll_day_base_id = (SELECT id FROM public.payroll_day_bases WHERE code = 'DAYS_MINUS_4'),
    billing_day_base_id = (SELECT id FROM public.billing_day_bases WHERE code = 'DAYS_MINUS_4'),
    updated_at = now()
WHERE r.id IN (SELECT id FROM lt);
