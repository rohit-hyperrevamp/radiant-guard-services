-- Explicit monthly role selections are separate from derived attendance flags.
CREATE TABLE public.attendance_role_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  is_reliever boolean NOT NULL,
  chosen_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, month, unit_id)
);
GRANT SELECT ON public.attendance_role_choices TO authenticated;
GRANT ALL ON public.attendance_role_choices TO service_role;
ALTER TABLE public.attendance_role_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_role_choices_read ON public.attendance_role_choices FOR SELECT TO authenticated
  USING (public.current_user_can_manage_attendance_unit(unit_id));
CREATE UNIQUE INDEX attendance_one_regular_choice ON public.attendance_role_choices(candidate_id, month) WHERE NOT is_reliever;
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.attendance_role_choices
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Attendance');

CREATE OR REPLACE FUNCTION public.apply_guard_attendance_rules(_cand uuid, _from date, _to date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m date; v_primary uuid; v_units int; g record; r record;
  v_base uuid; v_pin uuid; v_cap numeric; v_present numeric; v_changed int := 0; v_prev text;
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
        AND NOT EXISTS (SELECT 1 FROM attendance_role_choices rc WHERE rc.candidate_id = _cand AND rc.month = m AND rc.unit_id = x.unit_id AND rc.is_reliever)
      GROUP BY 1, 2),
    rn AS (SELECT unit_id, entry_date, row_number() OVER (PARTITION BY unit_id ORDER BY entry_date) k FROM d),
    tot AS (SELECT unit_id, max(k) n FROM rn GROUP BY 1),
    best AS (SELECT max(n) n FROM tot)
    SELECT t.unit_id, (SELECT count(*) FROM tot) INTO v_primary, v_units
    FROM tot t, best b, rn
    WHERE t.n = b.n AND rn.unit_id = t.unit_id AND rn.k = b.n
    ORDER BY rn.entry_date, (t.unit_id = (SELECT c.unit_id FROM candidates c WHERE c.id = _cand)) DESC, t.unit_id
    LIMIT 1;

    -- Super Admin pin: a chosen regular site for this month wins over "most days",
    -- as long as the person actually has attendance there this month.
    SELECT rc.unit_id INTO v_pin FROM attendance_role_choices rc
      WHERE rc.candidate_id = _cand AND rc.month = m AND NOT rc.is_reliever
      UNION ALL SELECT p.unit_id FROM attendance_primary_pins p
      WHERE p.candidate_id = _cand AND p.month = m
        AND NOT EXISTS (SELECT 1 FROM attendance_role_choices rc WHERE rc.candidate_id = _cand AND rc.month = m AND rc.unit_id = p.unit_id)
      LIMIT 1;
    IF v_pin IS NOT NULL AND EXISTS (SELECT 1 FROM _gar WHERE unit_id = v_pin) THEN
      v_primary := v_pin;
    END IF;

    -- Explicit reliever choices stay ED-only even at the only attended site.
    UPDATE attendance_entries ae SET is_reliever = true
      FROM _gar x WHERE x.id = ae.id AND NOT x.locked AND NOT ae.is_reliever
        AND EXISTS (SELECT 1 FROM attendance_role_choices rc WHERE rc.candidate_id = _cand AND rc.month = m AND rc.unit_id = x.unit_id AND rc.is_reliever)
        AND NOT EXISTS (SELECT 1 FROM attendance_entries o WHERE o.unit_id = ae.unit_id AND o.candidate_id = ae.candidate_id
          AND o.designation_id IS NOT DISTINCT FROM ae.designation_id AND o.shift_hours = ae.shift_hours
          AND o.entry_date = ae.entry_date AND o.is_reliever);
    UPDATE _gar x SET is_reliever = ae.is_reliever FROM attendance_entries ae WHERE ae.id = x.id;

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
    IF v_primary IS NOT NULL OR EXISTS (SELECT 1 FROM attendance_role_choices rc WHERE rc.candidate_id = _cand AND rc.month = m AND rc.is_reliever) THEN
      UPDATE attendance_entries ae SET rule_orig_code = ae.code, rule_orig_ot = coalesce(ae.ot_hours, 0),
          rule_applied = true, code = '', ot_hours = coalesce(ae.ot_hours, 0) + coalesce(ac.day_value, 1)
        FROM _gar x, attendance_codes ac
        WHERE x.id = ae.id AND NOT x.locked AND (x.unit_id <> v_primary OR ae.is_reliever OR EXISTS (SELECT 1 FROM attendance_role_choices rc WHERE rc.candidate_id = _cand AND rc.month = m AND rc.unit_id = x.unit_id AND rc.is_reliever))
          AND ac.code = ae.code AND ac.counts_as_present;
      GET DIAGNOSTICS v_present = ROW_COUNT; v_changed := v_changed + v_present;
      IF v_primary IS NOT NULL AND m >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date THEN
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


-- One request saves the monthly choice, posting and existing attendance line.
CREATE OR REPLACE FUNCTION public.save_attendance_role_line(
  _candidate_id uuid, _unit_id uuid, _designation_id uuid, _shift_hours integer,
  _is_reliever boolean, _period_start date, _period_end date,
  _edit boolean DEFAULT false, _old_line_id uuid DEFAULT NULL,
  _old_designation_id uuid DEFAULT NULL, _old_shift_hours integer DEFAULT 0,
  _old_is_reliever boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_month date; v_line uuid; v_prev text; v_sheet attendance_sheets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.current_user_can_manage_attendance_unit(_unit_id),false) THEN
    RAISE EXCEPTION 'Not authorized to edit this attendance';
  END IF;
  IF _candidate_id IS NULL OR _unit_id IS NULL OR _period_start IS NULL OR _period_end IS NULL
     OR _period_start > _period_end OR _period_end - _period_start > 62
     OR _is_reliever IS NULL OR coalesce(_shift_hours,0) NOT IN (0,8,10,12) THEN
    RAISE EXCEPTION 'Invalid employee, attendance period or duty length';
  END IF;
  PERFORM 1 FROM candidates WHERE id = _candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
  SELECT * INTO v_sheet FROM attendance_sheets WHERE unit_id = _unit_id
    AND period_start = _period_start AND period_end = _period_end FOR UPDATE;
  IF NOT coalesce((
    (coalesce(v_sheet.status,'draft') IN ('draft','rejected') OR v_sheet.amendment_status='open')
      AND coalesce(public.current_user_action_allowed('attendance','mark','edit'),false)
    OR (v_sheet.status='submitted' OR v_sheet.amendment_status='submitted')
      AND coalesce(public.current_user_action_allowed('attendance','approve','approve'),false)
  ),false) THEN RAISE EXCEPTION 'Attendance is closed or editing is not permitted'; END IF;
  v_month := date_trunc('month',_period_end)::date;
  IF EXISTS (SELECT 1 FROM payroll_runs WHERE unit_id=_unit_id AND payroll_status='processed'
    AND period_start<=_period_end AND period_end>=_period_start) THEN
    RAISE EXCEPTION 'Payroll for this period is already processed';
  END IF;
  -- A role change can reclassify other sites, so lock all processed periods for this person.
  IF EXISTS (SELECT 1 FROM attendance_entries ae JOIN payroll_runs pr ON pr.unit_id=ae.unit_id
    AND ae.entry_date BETWEEN pr.period_start AND pr.period_end
    WHERE ae.candidate_id=_candidate_id AND pr.payroll_status='processed'
      AND date_trunc('month',pr.period_end)::date=v_month) THEN
    RAISE EXCEPTION 'Payroll for this month is already processed';
  END IF;
  v_prev := coalesce(current_setting('app.skip_attendance_rules',true),'');
  PERFORM set_config('app.skip_attendance_rules','on',true);
  -- A regular selection replaces the previous explicit regular selection only.
  IF NOT _is_reliever THEN
    DELETE FROM attendance_role_choices WHERE candidate_id=_candidate_id AND month=v_month AND NOT is_reliever AND unit_id<>_unit_id;
  END IF;
  INSERT INTO attendance_role_choices(candidate_id,month,unit_id,is_reliever,chosen_by)
    VALUES(_candidate_id,v_month,_unit_id,_is_reliever,auth.uid())
    ON CONFLICT(candidate_id,month,unit_id) DO UPDATE SET is_reliever=excluded.is_reliever,chosen_by=excluded.chosen_by,created_at=now();
  IF _edit AND _old_line_id IS NOT NULL THEN
    SELECT id INTO v_line FROM candidate_units WHERE id=_old_line_id AND candidate_id=_candidate_id AND unit_id=_unit_id FOR UPDATE;
    IF v_line IS NULL THEN RAISE EXCEPTION 'The posting changed; reopen the attendance sheet'; END IF;
  ELSE
    SELECT id INTO v_line FROM candidate_units WHERE candidate_id=_candidate_id AND unit_id=_unit_id
      AND designation_id IS NOT DISTINCT FROM _designation_id AND coalesce(shift_hours,0)=coalesce(_shift_hours,0)
      AND is_reliever=_is_reliever LIMIT 1;
  END IF;
  IF v_line IS NULL THEN
    INSERT INTO candidate_units(candidate_id,unit_id,designation_id,shift_hours,is_reliever,is_primary)
      VALUES(_candidate_id,_unit_id,_designation_id,nullif(_shift_hours,0),_is_reliever,NOT _is_reliever);
  ELSE
    UPDATE candidate_units SET designation_id=_designation_id,shift_hours=nullif(_shift_hours,0),is_reliever=_is_reliever,is_primary=NOT _is_reliever WHERE id=v_line;
  END IF;
  IF _edit THEN
    UPDATE attendance_entries SET designation_id=_designation_id,shift_hours=coalesce(_shift_hours,0),is_reliever=_is_reliever
      WHERE candidate_id=_candidate_id AND unit_id=_unit_id AND designation_id IS NOT DISTINCT FROM _old_designation_id
        AND shift_hours=coalesce(_old_shift_hours,0) AND is_reliever=_old_is_reliever
        AND entry_date BETWEEN _period_start AND _period_end;
  END IF;
  PERFORM set_config('app.skip_attendance_rules',v_prev,true);
  PERFORM apply_guard_attendance_rules(_candidate_id,_period_start,_period_end);
END $$;
REVOKE ALL ON FUNCTION public.save_attendance_role_line(uuid,uuid,uuid,integer,boolean,date,date,boolean,uuid,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_attendance_role_line(uuid,uuid,uuid,integer,boolean,date,date,boolean,uuid,uuid,integer,boolean) TO authenticated,service_role;
