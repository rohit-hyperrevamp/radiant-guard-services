-- Present-day cap also honours "Days Minus N" day rules (e.g. Days Minus Four:
-- 31-day window -> 27 present days), not just Fixed N. Previously such
-- contracts were never capped, and a contract switched from Fixed 26 kept the
-- 27th day stored as Extra Duty.
CREATE OR REPLACE FUNCTION public.enforce_contract_present_day_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_counts_as_present boolean := false;
  v_day_value numeric := 0;
  v_method text;
  v_fixed_days numeric;
  v_cap numeric;
  v_contract_id uuid;
  v_current_present numeric := 0;
  v_period_start date;
  v_period_end date;
  v_start_day integer;
  v_end_day integer;
  v_anchor date;
  v_target date;
BEGIN
  SELECT COALESCE(ac.counts_as_present, false),
         CASE WHEN COALESCE(ac.counts_as_present, false) THEN COALESCE(ac.day_value, 1) ELSE 0 END
    INTO v_counts_as_present, v_day_value
  FROM public.attendance_codes ac
  WHERE ac.code = NEW.code;

  IF NOT COALESCE(v_counts_as_present, false) THEN
    RETURN NEW;
  END IF;

  SELECT cc.id INTO v_contract_id
  FROM public.client_contracts cc
  WHERE cc.unit_id = NEW.unit_id
    AND cc.record_type = 'client'
    AND cc.status = 'active'
    AND cc.start_date <= NEW.entry_date
    AND (cc.end_date IS NULL OR cc.end_date >= NEW.entry_date)
  ORDER BY cc.start_date DESC, cc.created_at DESC
  LIMIT 1;

  IF v_contract_id IS NULL THEN RETURN NEW; END IF;

  SELECT pdb.method, pdb.fixed_days INTO v_method, v_fixed_days
  FROM public.contract_resources cr
  JOIN public.payroll_day_bases pdb ON pdb.id = cr.payroll_day_base_id
  WHERE cr.contract_id = v_contract_id
    AND cr.designation_id = NEW.designation_id
  ORDER BY cr.sort_order ASC, cr.created_at ASC
  LIMIT 1;

  IF v_method IS NULL OR v_method NOT IN ('fixed_days', 'actual_minus_days') OR COALESCE(v_fixed_days, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT pw.window_start_day, pw.window_end_day INTO v_start_day, v_end_day
  FROM public.client_contracts cc
  JOIN public.payroll_windows pw ON pw.id = cc.payroll_window_id
  WHERE cc.id = v_contract_id;

  IF COALESCE(v_start_day, 1) > 1 AND COALESCE(v_end_day, 0) > 0 AND v_end_day < v_start_day THEN
    IF EXTRACT(DAY FROM NEW.entry_date)::int >= v_start_day THEN
      v_anchor := date_trunc('month', NEW.entry_date)::date;
    ELSE
      v_anchor := (date_trunc('month', NEW.entry_date) - interval '1 month')::date;
    END IF;
    v_period_start := LEAST(v_anchor + (v_start_day - 1), (v_anchor + interval '1 month - 1 day')::date);
    v_period_end := LEAST((v_anchor + interval '1 month')::date + (v_end_day - 1), (v_anchor + interval '2 month - 1 day')::date);
  ELSE
    v_period_start := date_trunc('month', NEW.entry_date)::date;
    v_period_end := (date_trunc('month', NEW.entry_date) + interval '1 month - 1 day')::date;
  END IF;

  -- Present-day cap for the period: a fixed number, or (for "Days Minus N")
  -- the period's calendar days minus N, e.g. 31-day window - 4 = 27.
  IF v_method = 'actual_minus_days' THEN
    v_cap := GREATEST((v_period_end - v_period_start + 1) - v_fixed_days, 1);
  ELSE
    v_cap := v_fixed_days;
  END IF;

  SELECT COALESCE(SUM(COALESCE(ac.day_value, 1)), 0) INTO v_current_present
  FROM public.attendance_entries ae
  JOIN public.attendance_codes ac ON ac.code = ae.code
  WHERE ae.unit_id = NEW.unit_id
    AND ae.candidate_id = NEW.candidate_id
    AND ae.designation_id IS NOT DISTINCT FROM NEW.designation_id AND ae.shift_hours = NEW.shift_hours AND ae.is_reliever = NEW.is_reliever
    AND ae.entry_date BETWEEN v_period_start AND v_period_end
    AND ac.counts_as_present = true
    AND ae.entry_date <> NEW.entry_date
    AND NOT (
      TG_OP = 'UPDATE'
      AND ae.unit_id = OLD.unit_id
      AND ae.candidate_id = OLD.candidate_id
      AND ae.designation_id IS NOT DISTINCT FROM OLD.designation_id AND ae.shift_hours = OLD.shift_hours AND ae.is_reliever = OLD.is_reliever
      AND ae.entry_date = OLD.entry_date
    );

  -- Paid-days cap reached: the duty is NOT discarded. It is converted into
  -- Extra Duty (code blanked, day value stored in ot_hours, which holds ED
  -- DAYS). If this date ALREADY carries extra duty, the converted day is not
  -- stacked on top of it -- it is placed on the next free date in the same
  -- period (no code, no extra duty, not in the future). Only when no free
  -- date remains does it fall back to stacking on the same date.
  IF v_current_present + v_day_value > v_cap THEN
    NEW.code := '';
    IF COALESCE(NEW.ot_hours, 0) > 0 THEN
      SELECT d::date INTO v_target
      FROM generate_series(NEW.entry_date + 1, LEAST(v_period_end, CURRENT_DATE), interval '1 day') AS d
      WHERE NOT EXISTS (
        SELECT 1 FROM public.attendance_entries ae
        WHERE ae.unit_id = NEW.unit_id
          AND ae.candidate_id = NEW.candidate_id
          AND ae.designation_id IS NOT DISTINCT FROM NEW.designation_id AND ae.shift_hours = NEW.shift_hours AND ae.is_reliever = NEW.is_reliever
          AND ae.entry_date = d::date
          AND (COALESCE(ae.ot_hours, 0) > 0 OR COALESCE(ae.code, '') <> '')
      )
      ORDER BY d
      LIMIT 1;

      IF v_target IS NOT NULL THEN
        INSERT INTO public.attendance_entries (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours)
        VALUES (NEW.unit_id, NEW.candidate_id, NEW.designation_id, NEW.shift_hours, NEW.is_reliever, v_target, '', v_day_value)
        ON CONFLICT (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date)
        DO UPDATE SET code = '', ot_hours = EXCLUDED.ot_hours;
      ELSE
        NEW.ot_hours := COALESCE(NEW.ot_hours, 0) + v_day_value;
      END IF;
    ELSE
      NEW.ot_hours := v_day_value;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
