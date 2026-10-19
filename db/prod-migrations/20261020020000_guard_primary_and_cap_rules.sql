-- Global attendance rules (apply to every source: screen, upload, Pages import, code, bulk SQL):
--  1. Primary unit per guard per month = unit with most working days (distinct dates with a duty);
--     tie -> the unit that reached that count first. All present days at the other units become Extra Duty.
--  2. At the primary unit, Present days beyond the role's payroll-days cap (Fixed 26/27/28/30, Days minus N...)
--     become Extra Duty (latest dates first).
-- Every conversion keeps the original code/ED so rules can be re-run when attendance changes.
-- Skip only on explicit instruction: SET LOCAL app.skip_attendance_rules = 'on'.
-- Processed payroll periods are never touched. Manual reliever rows (is_reliever) are left as they are
-- and do not count towards choosing the primary unit. Field officers are excluded.

ALTER TABLE public.attendance_entries
  ADD COLUMN IF NOT EXISTS rule_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rule_orig_code text,
  ADD COLUMN IF NOT EXISTS rule_orig_ot numeric;

UPDATE public.payroll_day_bases SET caps_present = true WHERE NOT caps_present;

CREATE OR REPLACE FUNCTION public.apply_guard_attendance_rules(_cand uuid, _from date, _to date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m date; v_primary uuid; v_units int; g record; r record;
  v_base uuid; v_cap numeric; v_present numeric; v_changed int := 0; v_prev text;
BEGIN
  IF coalesce(current_setting('app.skip_attendance_rules', true), '') = 'on' THEN RETURN 0; END IF;
  IF _cand IS NULL OR public.is_active_field_officer(_cand) THEN RETURN 0; END IF;
  v_prev := coalesce(current_setting('app.attendance_rules_running', true), '');
  PERFORM set_config('app.attendance_rules_running', 'on', true);

  CREATE TEMP TABLE IF NOT EXISTS _gar (
    id uuid, unit_id uuid, ps date, pe date, entry_date date, designation_id uuid,
    shift_hours int, is_reliever boolean, locked boolean DEFAULT false) ON COMMIT DROP;

  FOR m IN SELECT generate_series(date_trunc('month', _from), date_trunc('month', _to) + interval '1 month', interval '1 month')::date LOOP
    TRUNCATE _gar;
    INSERT INTO _gar (id, unit_id, ps, pe, entry_date, designation_id, shift_hours, is_reliever)
    SELECT ae.id, ae.unit_id, b.ps, b.pe, ae.entry_date, ae.designation_id, ae.shift_hours, ae.is_reliever
    FROM attendance_entries ae
    LEFT JOIN LATERAL (
      SELECT pw.window_start_day s, pw.window_end_day e FROM client_contracts cc
      LEFT JOIN payroll_windows pw ON pw.id = cc.payroll_window_id
      WHERE cc.unit_id = ae.unit_id AND cc.record_type = 'client' AND cc.status = 'active'
      ORDER BY cc.start_date DESC, cc.created_at DESC LIMIT 1) w ON true
    CROSS JOIN LATERAL attendance_period_bounds(w.s, w.e, ae.entry_date) b
    WHERE ae.candidate_id = _cand
      AND ae.entry_date BETWEEN m - 45 AND m + 62
      AND date_trunc('month', b.pe)::date = m;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE _gar SET locked = true WHERE EXISTS (
      SELECT 1 FROM payroll_runs pr WHERE pr.unit_id = _gar.unit_id AND pr.period_start = _gar.ps
        AND pr.payroll_status = 'processed');

    -- Undo earlier conversions so the rules are re-evaluated from the original attendance.
    UPDATE attendance_entries ae SET code = 'P', ot_hours = ae.ot_hours - 1, ed_from_cap = false
      FROM _gar x WHERE x.id = ae.id AND NOT x.locked AND NOT ae.rule_applied AND ae.ed_from_cap
        AND NOT ae.is_reliever AND coalesce(ae.code, '') = '' AND coalesce(ae.ot_hours, 0) >= 1;
    UPDATE attendance_entries ae SET code = ae.rule_orig_code, ot_hours = ae.rule_orig_ot,
        rule_applied = false, rule_orig_code = NULL, rule_orig_ot = NULL, ed_from_cap = false
      FROM _gar x WHERE x.id = ae.id AND NOT x.locked AND ae.rule_applied;

    -- Primary unit: most working days; tie -> reached that count first; then current home unit.
    WITH d AS (
      SELECT x.unit_id, x.entry_date FROM _gar x JOIN attendance_entries ae ON ae.id = x.id
      LEFT JOIN attendance_codes ac ON ac.code = ae.code
      WHERE NOT x.is_reliever AND (coalesce(ac.counts_as_present, false) OR coalesce(ae.ot_hours, 0) > 0)
      GROUP BY 1, 2),
    rn AS (SELECT unit_id, entry_date, row_number() OVER (PARTITION BY unit_id ORDER BY entry_date) k FROM d),
    tot AS (SELECT unit_id, max(k) n FROM rn GROUP BY 1),
    best AS (SELECT max(n) n FROM tot)
    SELECT t.unit_id, (SELECT count(*) FROM tot) INTO v_primary, v_units
    FROM tot t, best b, rn
    WHERE t.n = b.n AND rn.unit_id = t.unit_id AND rn.k = b.n
    ORDER BY rn.entry_date, (t.unit_id = (SELECT c.unit_id FROM candidates c WHERE c.id = _cand)) DESC, t.unit_id
    LIMIT 1;

    -- Rule 1: other units -> Extra Duty only.
    IF v_primary IS NOT NULL AND v_units > 1 THEN
      UPDATE attendance_entries ae SET rule_orig_code = ae.code, rule_orig_ot = coalesce(ae.ot_hours, 0),
          rule_applied = true, code = '', ot_hours = coalesce(ae.ot_hours, 0) + coalesce(ac.day_value, 1)
        FROM _gar x, attendance_codes ac
        WHERE x.id = ae.id AND NOT x.locked AND x.unit_id <> v_primary AND NOT ae.is_reliever
          AND ac.code = ae.code AND ac.counts_as_present;
      GET DIAGNOSTICS v_present = ROW_COUNT; v_changed := v_changed + v_present;
      IF m >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date THEN
        UPDATE candidates SET unit_id = v_primary WHERE id = _cand AND unit_id IS DISTINCT FROM v_primary;
      END IF;
    END IF;

    -- Rule 2: payroll-days cap at the primary (or only) unit.
    FOR g IN SELECT DISTINCT x.unit_id, x.designation_id, x.shift_hours, x.ps, x.pe FROM _gar x
             WHERE NOT x.locked AND NOT x.is_reliever AND (v_primary IS NULL OR x.unit_id = v_primary) LOOP
      SELECT cr.payroll_day_base_id INTO v_base FROM contract_resources cr
        JOIN client_contracts cc ON cc.id = cr.contract_id
       WHERE cc.unit_id = g.unit_id AND cc.record_type = 'client' AND cc.status = 'active'
         AND cr.designation_id IS NOT DISTINCT FROM g.designation_id
       ORDER BY (cr.shift_hours = g.shift_hours) DESC, cc.start_date DESC, cr.sort_order, cr.created_at LIMIT 1;
      v_cap := present_cap_for_period(v_base, g.ps, g.pe);
      IF v_cap IS NULL THEN CONTINUE; END IF;
      SELECT coalesce(sum(coalesce(ac.day_value, 1)), 0) INTO v_present
        FROM _gar x JOIN attendance_entries ae ON ae.id = x.id JOIN attendance_codes ac ON ac.code = ae.code AND ac.counts_as_present
       WHERE x.unit_id = g.unit_id AND x.designation_id IS NOT DISTINCT FROM g.designation_id
         AND x.shift_hours = g.shift_hours AND x.ps = g.ps AND NOT x.is_reliever;
      FOR r IN SELECT ae.id, coalesce(ac.day_value, 1) dv
        FROM _gar x JOIN attendance_entries ae ON ae.id = x.id JOIN attendance_codes ac ON ac.code = ae.code AND ac.counts_as_present
       WHERE x.unit_id = g.unit_id AND x.designation_id IS NOT DISTINCT FROM g.designation_id
         AND x.shift_hours = g.shift_hours AND x.ps = g.ps AND NOT x.is_reliever
       ORDER BY ae.entry_date DESC LOOP
        EXIT WHEN v_present <= v_cap;
        UPDATE attendance_entries SET rule_orig_code = code, rule_orig_ot = coalesce(ot_hours, 0), rule_applied = true,
            code = '', ot_hours = coalesce(ot_hours, 0) + r.dv, ed_from_cap = true WHERE id = r.id;
        v_present := v_present - r.dv; v_changed := v_changed + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  PERFORM set_config('app.attendance_rules_running', v_prev, true);
  RETURN v_changed;
END $$;

-- Statement-level enforcement: any write to attendance re-applies the rules for the guards it touched.
CREATE OR REPLACE FUNCTION public.attendance_entries_apply_rules_stmt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF coalesce(current_setting('app.attendance_rules_running', true), '') = 'on'
     OR coalesce(current_setting('app.skip_attendance_rules', true), '') = 'on' THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN
    FOR r IN SELECT candidate_id, min(entry_date) f, max(entry_date) t FROM old_rows GROUP BY 1 LOOP
      PERFORM public.apply_guard_attendance_rules(r.candidate_id, r.f, r.t); END LOOP;
  ELSE
    FOR r IN SELECT candidate_id, min(entry_date) f, max(entry_date) t FROM new_rows GROUP BY 1 LOOP
      PERFORM public.apply_guard_attendance_rules(r.candidate_id, r.f, r.t); END LOOP;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_attendance_rules_ins ON public.attendance_entries;
DROP TRIGGER IF EXISTS zz_attendance_rules_upd ON public.attendance_entries;
DROP TRIGGER IF EXISTS zz_attendance_rules_del ON public.attendance_entries;
CREATE TRIGGER zz_attendance_rules_ins AFTER INSERT ON public.attendance_entries
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.attendance_entries_apply_rules_stmt();
CREATE TRIGGER zz_attendance_rules_upd AFTER UPDATE ON public.attendance_entries
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.attendance_entries_apply_rules_stmt();
CREATE TRIGGER zz_attendance_rules_del AFTER DELETE ON public.attendance_entries
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.attendance_entries_apply_rules_stmt();

-- The old per-row cap is superseded by the statement rule (which also re-evaluates on edits/deletes).
CREATE OR REPLACE FUNCTION public.enforce_contract_present_day_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN NEW; END $$;

-- Reliever guard: the rules engine itself may write freely.
CREATE OR REPLACE FUNCTION public.enforce_reliever_extra_duty_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.attendance_rules_running', true), '') = 'on' THEN RETURN NEW; END IF;
  IF coalesce(current_setting('app.attendance_source', true), '') = 'import' THEN
    IF NEW.is_reliever AND NEW.code <> '' THEN
      RAISE EXCEPTION 'Reliever attendance at this unit must be recorded as Extra Duty';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NOT NEW.is_reliever AND NOT NEW.ed_from_cap THEN
    IF NOT EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = NEW.candidate_id AND c.unit_id = NEW.unit_id)
       AND NOT EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = NEW.candidate_id AND cu.unit_id = NEW.unit_id AND NOT cu.is_reliever)
       AND EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = NEW.candidate_id AND cu.unit_id = NEW.unit_id AND cu.is_reliever)
    THEN
      NEW.is_reliever := true;
    END IF;
  END IF;
  IF NEW.is_reliever AND NEW.code <> '' THEN
    RAISE EXCEPTION 'Reliever attendance at this unit must be recorded as Extra Duty';
  END IF;
  RETURN NEW;
END $$;

-- Payroll-days change on a contract line: re-apply the rules for that unit's guards (recent, unprocessed periods).
CREATE OR REPLACE FUNCTION public.contract_resource_rebalance_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_unit uuid;
BEGIN
  IF NEW.designation_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.payroll_day_base_id IS NOT DISTINCT FROM OLD.payroll_day_base_id
     AND NEW.designation_id IS NOT DISTINCT FROM OLD.designation_id THEN RETURN NEW; END IF;
  SELECT unit_id INTO v_unit FROM client_contracts WHERE id = NEW.contract_id;
  FOR r IN SELECT DISTINCT candidate_id FROM attendance_entries
           WHERE unit_id = v_unit AND entry_date >= (date_trunc('month', CURRENT_DATE) - interval '2 month')::date LOOP
    PERFORM public.apply_guard_attendance_rules(r.candidate_id,
      (date_trunc('month', CURRENT_DATE) - interval '2 month')::date, CURRENT_DATE);
  END LOOP;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_guard_attendance_rules(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_guard_attendance_rules(uuid, date, date) TO authenticated, service_role;
