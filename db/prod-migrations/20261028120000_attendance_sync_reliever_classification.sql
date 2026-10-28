CREATE OR REPLACE FUNCTION public.apply_guard_attendance_rules(_cand uuid, _from date, _to date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHERE (coalesce(ac.counts_as_present, false) OR coalesce(ae.ot_hours, 0) > 0)
      GROUP BY 1, 2),
    rn AS (SELECT unit_id, entry_date, row_number() OVER (PARTITION BY unit_id ORDER BY entry_date) k FROM d),
    tot AS (SELECT unit_id, max(k) n FROM rn GROUP BY 1),
    best AS (SELECT max(n) n FROM tot)
    SELECT t.unit_id, (SELECT count(*) FROM tot) INTO v_primary, v_units
    FROM tot t, best b, rn
    WHERE t.n = b.n AND rn.unit_id = t.unit_id AND rn.k = b.n
    ORDER BY rn.entry_date, (t.unit_id = (SELECT c.unit_id FROM candidates c WHERE c.id = _cand)) DESC, t.unit_id
    LIMIT 1;

    -- Rule 0: the unit with most working days is regular, even if it was entered as reliever.
    IF v_primary IS NOT NULL THEN
      UPDATE attendance_entries ae SET is_reliever = false,
          code = CASE WHEN coalesce(ae.code,'') = '' AND coalesce(ae.ot_hours,0) >= 1 THEN 'P' ELSE ae.code END,
          ot_hours = CASE WHEN coalesce(ae.code,'') = '' AND coalesce(ae.ot_hours,0) >= 1 THEN ae.ot_hours - 1 ELSE ae.ot_hours END
        FROM _gar x WHERE x.id = ae.id AND NOT x.locked AND x.unit_id = v_primary AND ae.is_reliever
          AND NOT EXISTS (SELECT 1 FROM attendance_entries o WHERE o.unit_id = ae.unit_id AND o.candidate_id = ae.candidate_id
            AND o.designation_id IS NOT DISTINCT FROM ae.designation_id AND o.shift_hours IS NOT DISTINCT FROM ae.shift_hours
            AND o.entry_date = ae.entry_date AND NOT o.is_reliever);
      GET DIAGNOSTICS v_present = ROW_COUNT; v_changed := v_changed + v_present;
      UPDATE _gar x SET is_reliever = ae.is_reliever FROM attendance_entries ae WHERE ae.id = x.id;
    END IF;

    -- Rule 1: other units (and any leftover reliever line) -> Extra Duty only.
    IF v_primary IS NOT NULL THEN
      UPDATE attendance_entries ae SET rule_orig_code = ae.code, rule_orig_ot = coalesce(ae.ot_hours, 0),
          rule_applied = true, code = '', ot_hours = coalesce(ae.ot_hours, 0) + coalesce(ac.day_value, 1)
        FROM _gar x, attendance_codes ac
        WHERE x.id = ae.id AND NOT x.locked AND (x.unit_id <> v_primary OR ae.is_reliever)
          AND ac.code = ae.code AND ac.counts_as_present;
      GET DIAGNOSTICS v_present = ROW_COUNT; v_changed := v_changed + v_present;
      IF m >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date THEN
        UPDATE candidates SET unit_id = v_primary WHERE id = _cand AND unit_id IS DISTINCT FROM v_primary;
      END IF;
    END IF;

    -- Persist the monthly classification, not just its P -> ED amounts.
    -- Capped ED at the primary remains a regular line. Preserve duplicate
    -- sibling lines rather than colliding with their unique line keys.
    IF v_primary IS NOT NULL THEN
      UPDATE attendance_entries ae SET is_reliever = true
        FROM _gar x WHERE x.id = ae.id AND NOT x.locked
          AND x.unit_id <> v_primary AND NOT ae.is_reliever
          AND NOT EXISTS (SELECT 1 FROM attendance_entries o
            WHERE o.unit_id = ae.unit_id AND o.candidate_id = ae.candidate_id
              AND o.designation_id IS NOT DISTINCT FROM ae.designation_id
              AND o.shift_hours IS NOT DISTINCT FROM ae.shift_hours
              AND o.entry_date = ae.entry_date AND o.is_reliever);
      GET DIAGNOSTICS v_present = ROW_COUNT; v_changed := v_changed + v_present;
      UPDATE _gar x SET is_reliever = ae.is_reliever FROM attendance_entries ae WHERE ae.id = x.id;

      -- Site mappings are current, not historical: synchronize only recent,
      -- editable periods. Mark the winning posting primary first so the
      -- existing single-primary trigger cannot force it back to reliever.
      IF m >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date
         AND EXISTS (SELECT 1 FROM _gar WHERE unit_id = v_primary AND NOT locked) THEN
        UPDATE candidate_units SET is_primary = true, is_reliever = false
          WHERE id = (SELECT cu.id FROM candidate_units cu
            WHERE cu.candidate_id = _cand AND cu.unit_id = v_primary
            ORDER BY cu.is_reliever, cu.is_primary DESC, cu.created_at, cu.id LIMIT 1)
          AND (NOT is_primary OR is_reliever);
        UPDATE candidate_units cu SET is_primary = false, is_reliever = true
          WHERE cu.candidate_id = _cand AND cu.unit_id <> v_primary
            AND (cu.is_primary OR NOT cu.is_reliever)
            AND EXISTS (SELECT 1 FROM _gar x WHERE x.unit_id = cu.unit_id AND NOT x.locked)
            AND NOT EXISTS (SELECT 1 FROM candidate_units o
              WHERE o.candidate_id = cu.candidate_id AND o.unit_id = cu.unit_id
                AND o.designation_id IS NOT DISTINCT FROM cu.designation_id
                AND o.shift_hours IS NOT DISTINCT FROM cu.shift_hours
                AND o.id <> cu.id AND o.is_reliever);
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
END $function$

;
