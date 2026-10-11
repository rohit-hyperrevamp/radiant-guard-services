-- Changing a contract line's Payroll Days (e.g. Fixed 26 -> Actual Days) must
-- re-shape attendance that is already stored. Before this, days that had been
-- converted to Extra Duty under the old 26-day limit stayed Extra Duty forever,
-- and a tighter limit never converted the excess Present days.
BEGIN;

-- 1. Mark days that were turned into Extra Duty only because of the limit, so
--    they can be turned back into Present when the limit is relaxed.
ALTER TABLE public.attendance_entries ADD COLUMN IF NOT EXISTS ed_from_cap boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.attendance_entries.ed_from_cap IS
  'True when the Extra Duty on this row came from the contract Payroll Days limit (not real extra duty).';

-- 2. Period bounds for a payroll window (same rule as the present-day limit).
CREATE OR REPLACE FUNCTION public.attendance_period_bounds(_start_day integer, _end_day integer, _d date)
RETURNS TABLE(ps date, pe date)
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE v_anchor date;
BEGIN
  IF COALESCE(_start_day, 1) > 1 AND COALESCE(_end_day, 0) > 0 AND _end_day < _start_day THEN
    IF EXTRACT(DAY FROM _d)::int >= _start_day THEN
      v_anchor := date_trunc('month', _d)::date;
    ELSE
      v_anchor := (date_trunc('month', _d) - interval '1 month')::date;
    END IF;
    ps := LEAST(v_anchor + (_start_day - 1), (v_anchor + interval '1 month - 1 day')::date);
    pe := LEAST((v_anchor + interval '1 month')::date + (_end_day - 1), (v_anchor + interval '2 month - 1 day')::date);
  ELSE
    ps := date_trunc('month', _d)::date;
    pe := (date_trunc('month', _d) + interval '1 month - 1 day')::date;
  END IF;
  RETURN NEXT;
END;
$function$;

-- 3. Present-day limit of a Payroll Days rule for a period (NULL = no limit).
--    Mirrors resolvePayrollDayCount() used by the attendance screen.
CREATE OR REPLACE FUNCTION public.present_cap_for_period(_base_id uuid, _start date, _end date)
RETURNS numeric
LANGUAGE sql STABLE SET search_path TO 'public'
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
  WHERE b.id = _base_id;
$function$;

-- 4. Re-shape stored attendance of one contract line after its Payroll Days
--    rule changed. Only recent periods (current + two previous months) whose
--    payroll is not processed are touched; reliever lines are never touched.
CREATE OR REPLACE FUNCTION public.rebalance_attendance_present_cap(_contract_id uuid, _designation_id uuid, _old_base uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  ln record;
  r record;
  v_new_base uuid;
  v_from date;
  v_to date;
  v_new_cap numeric;
  v_old_cap numeric;
  v_present numeric;
  v_target date;
  v_changed integer := 0;
BEGIN
  SELECT cc.unit_id, cc.start_date, cc.end_date, cc.record_type, cc.status,
         pw.window_start_day, pw.window_end_day
    INTO c
  FROM public.client_contracts cc
  LEFT JOIN public.payroll_windows pw ON pw.id = cc.payroll_window_id
  WHERE cc.id = _contract_id;
  IF c.unit_id IS NULL OR c.record_type <> 'client' OR c.status <> 'active' THEN RETURN 0; END IF;

  -- Effective rule for the designation (first line, same as the limit trigger).
  SELECT cr.payroll_day_base_id INTO v_new_base
  FROM public.contract_resources cr
  WHERE cr.contract_id = _contract_id AND cr.designation_id = _designation_id
  ORDER BY cr.sort_order ASC, cr.created_at ASC
  LIMIT 1;

  v_from := GREATEST(c.start_date, (date_trunc('month', CURRENT_DATE) - interval '2 month')::date);
  v_to := LEAST(COALESCE(c.end_date, CURRENT_DATE), CURRENT_DATE);
  IF v_from > v_to THEN RETURN 0; END IF;

  FOR ln IN
    SELECT DISTINCT ae.candidate_id, ae.shift_hours, b.ps, b.pe
    FROM public.attendance_entries ae
    CROSS JOIN LATERAL public.attendance_period_bounds(c.window_start_day, c.window_end_day, ae.entry_date) b
    WHERE ae.unit_id = c.unit_id
      AND ae.designation_id = _designation_id
      AND NOT ae.is_reliever
      AND ae.entry_date BETWEEN v_from AND v_to
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      WHERE pr.unit_id = c.unit_id AND pr.period_start = ln.ps AND pr.payroll_status = 'processed'
    ) THEN
      CONTINUE;
    END IF;

    v_new_cap := public.present_cap_for_period(v_new_base, ln.ps, ln.pe);
    v_old_cap := public.present_cap_for_period(_old_base, ln.ps, ln.pe);

    SELECT COALESCE(SUM(COALESCE(ac.day_value, 1)), 0) INTO v_present
    FROM public.attendance_entries ae
    JOIN public.attendance_codes ac ON ac.code = ae.code AND ac.counts_as_present
    WHERE ae.unit_id = c.unit_id AND ae.candidate_id = ln.candidate_id
      AND ae.designation_id = _designation_id AND ae.shift_hours = ln.shift_hours
      AND NOT ae.is_reliever AND ae.entry_date BETWEEN ln.ps AND ln.pe;

    IF v_new_cap IS NOT NULL AND v_present > v_new_cap THEN
      -- Tighter limit: the latest Present days beyond it become Extra Duty.
      FOR r IN
        SELECT ae.id, ae.entry_date, COALESCE(ae.ot_hours, 0) AS ot, COALESCE(ac.day_value, 1) AS dv
        FROM public.attendance_entries ae
        JOIN public.attendance_codes ac ON ac.code = ae.code AND ac.counts_as_present
        WHERE ae.unit_id = c.unit_id AND ae.candidate_id = ln.candidate_id
          AND ae.designation_id = _designation_id AND ae.shift_hours = ln.shift_hours
          AND NOT ae.is_reliever AND ae.entry_date BETWEEN ln.ps AND ln.pe
        ORDER BY ae.entry_date DESC
      LOOP
        EXIT WHEN v_present <= v_new_cap;
        IF r.ot > 0 THEN
          -- Do not stack on a date that already has Extra Duty: use a free date.
          SELECT d::date INTO v_target
          FROM generate_series(ln.ps, LEAST(ln.pe, CURRENT_DATE), interval '1 day') d
          WHERE NOT EXISTS (
            SELECT 1 FROM public.attendance_entries x
            WHERE x.unit_id = c.unit_id AND x.candidate_id = ln.candidate_id
              AND x.designation_id = _designation_id AND x.shift_hours = ln.shift_hours
              AND NOT x.is_reliever AND x.entry_date = d::date
              AND (COALESCE(x.ot_hours, 0) > 0 OR COALESCE(x.code, '') <> '')
          )
          ORDER BY d
          LIMIT 1;
          UPDATE public.attendance_entries SET code = '' WHERE id = r.id;
          IF v_target IS NOT NULL THEN
            INSERT INTO public.attendance_entries (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours, ed_from_cap)
            VALUES (c.unit_id, ln.candidate_id, _designation_id, ln.shift_hours, false, v_target, '', r.dv, true)
            ON CONFLICT (unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date)
            DO UPDATE SET code = '', ot_hours = EXCLUDED.ot_hours, ed_from_cap = true;
          ELSE
            UPDATE public.attendance_entries SET ot_hours = r.ot + r.dv, ed_from_cap = true WHERE id = r.id;
          END IF;
        ELSE
          UPDATE public.attendance_entries SET code = '', ot_hours = r.dv, ed_from_cap = true WHERE id = r.id;
        END IF;
        v_present := v_present - r.dv;
        v_changed := v_changed + 1;
      END LOOP;
    ELSIF v_new_cap IS NULL OR v_present < v_new_cap THEN
      -- Relaxed limit: Extra Duty that only existed because of the old limit
      -- goes back to Present. Older rows have no flag; they qualify when the
      -- old limit had actually been reached in that period.
      FOR r IN
        SELECT ae.id, COALESCE(ae.ot_hours, 0) AS ot
        FROM public.attendance_entries ae
        WHERE ae.unit_id = c.unit_id AND ae.candidate_id = ln.candidate_id
          AND ae.designation_id = _designation_id AND ae.shift_hours = ln.shift_hours
          AND NOT ae.is_reliever AND ae.entry_date BETWEEN ln.ps AND ln.pe
          AND COALESCE(ae.code, '') = '' AND COALESCE(ae.ot_hours, 0) >= 1
          AND (ae.ed_from_cap OR (v_old_cap IS NOT NULL AND v_present >= v_old_cap))
        ORDER BY ae.entry_date ASC
      LOOP
        EXIT WHEN v_new_cap IS NOT NULL AND v_present + 1 > v_new_cap;
        UPDATE public.attendance_entries
           SET code = 'P', ot_hours = r.ot - 1, ed_from_cap = false
         WHERE id = r.id;
        v_present := v_present + 1;
        v_changed := v_changed + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_changed;
END;
$function$;
REVOKE ALL ON FUNCTION public.rebalance_attendance_present_cap(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebalance_attendance_present_cap(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_resource_rebalance_attendance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.designation_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.payroll_day_base_id IS NOT DISTINCT FROM OLD.payroll_day_base_id
     AND NEW.designation_id IS NOT DISTINCT FROM OLD.designation_id THEN
    RETURN NEW;
  END IF;
  PERFORM public.rebalance_attendance_present_cap(
    NEW.contract_id, NEW.designation_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.payroll_day_base_id END);
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS zz_contract_resources_rebalance_attendance ON public.contract_resources;
CREATE TRIGGER zz_contract_resources_rebalance_attendance
  AFTER INSERT OR UPDATE OF payroll_day_base_id, designation_id ON public.contract_resources
  FOR EACH ROW EXECUTE FUNCTION public.contract_resource_rebalance_attendance();

COMMIT;
