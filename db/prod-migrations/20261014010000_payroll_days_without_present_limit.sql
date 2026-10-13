-- Some Pages contracts use the payroll days only as the pay divisor and pay every
-- duty above it as a normal (Present) day, e.g. CLI4096: 28 duties ÷ 26.
-- A payroll-day option can now say "do not limit Present days"; attendance
-- then keeps every P and only real overtime is Extra Duty.
ALTER TABLE public.payroll_day_bases ADD COLUMN IF NOT EXISTS caps_present boolean NOT NULL DEFAULT true;

INSERT INTO public.payroll_day_bases (name, code, method, fixed_days, description, is_default, enabled, sort_order, caps_present)
SELECT 'Days Minus Four (all duties as Present)', 'DAYS_MINUS_4_ALL_P', 'actual_minus_days', 4,
       'Pay divisor = window days minus 4 (30→26). Duties above it stay Present, not Extra Duty.', false, true, 61, false
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_day_bases WHERE code = 'DAYS_MINUS_4_ALL_P');

CREATE OR REPLACE FUNCTION public.present_cap_for_period(_base_id uuid, _start date, _end date)
 RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT CASE b.method
    WHEN 'fixed_days' THEN
      CASE WHEN COALESCE(b.fixed_days, 0) > 0 THEN LEAST(b.fixed_days, (_end - _start + 1)) END
    WHEN 'actual_minus_days' THEN
      CASE WHEN COALESCE(b.fixed_days, 0) > 0 THEN GREATEST((_end - _start + 1) - b.fixed_days, 1) END
    WHEN 'actual_minus_weekly_off' THEN
      CASE WHEN b.weekly_off_day IS NOT NULL THEN
        (SELECT count(*)::numeric FROM generate_series(_start, _end, interval '1 day') d
          WHERE EXTRACT(DOW FROM d)::int <> b.weekly_off_day) END
    WHEN 'custom_weekdays' THEN
      CASE WHEN COALESCE(array_length(b.included_weekdays, 1), 0) > 0 THEN
        (SELECT count(*)::numeric FROM generate_series(_start, _end, interval '1 day') d
          WHERE EXTRACT(DOW FROM d)::int = ANY (b.included_weekdays::int[])) END
    ELSE NULL
  END
  FROM public.payroll_day_bases b
  WHERE b.id = _base_id AND b.caps_present;
$function$;

DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_contract_present_day_limit'::regproc) INTO d;
  IF position('AND pdb.caps_present' IN d) = 0 THEN
    d := replace(d, E'JOIN public.payroll_day_bases pdb ON pdb.id = cr.payroll_day_base_id\n', E'JOIN public.payroll_day_bases pdb ON pdb.id = cr.payroll_day_base_id AND pdb.caps_present\n');
    EXECUTE d;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
