-- Per-site attendance summary for one employee in one attendance month, so the
-- sheet can explain "why is he a reliever here, and where is his regular site?".
-- Returns only counts (no rows), and only to someone who can read attendance at
-- the unit they are viewing.
CREATE OR REPLACE FUNCTION public.attendance_employee_site_summary(_cand uuid, _unit uuid, _month date)
RETURNS TABLE (
  unit_id uuid, unit_code text, unit_name text,
  period_start date, period_end date,
  present_days numeric, ed_days numeric, working_days integer,
  is_regular boolean, is_pinned boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m date := date_trunc('month', _month)::date;
  v_pin uuid;
BEGIN
  IF auth.uid() IS NULL OR _cand IS NULL OR _unit IS NULL THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT (
    public.is_admin_user()
    OR public.current_user_can_manage_attendance_unit(_unit)
    OR _unit = ANY (COALESCE(public.current_user_unit_ids(), '{}'::uuid[]))
    OR (COALESCE(public.current_user_role_key(), '') NOT IN ('hr_executive', 'accounts', 'field_officer')
        AND COALESCE(public.current_user_module_access('attendance', 'view'), false)
        AND ((NOT public.current_user_has_branch_scope()) OR public.is_unit_in_current_user_branch(_unit)))
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT p.unit_id INTO v_pin FROM attendance_primary_pins p
   WHERE p.candidate_id = _cand AND p.month = m;

  RETURN QUERY
  WITH e AS (
    SELECT ae.unit_id, ae.entry_date, ae.code, ae.ot_hours, ae.is_reliever, b.ps, b.pe
    FROM attendance_entries ae
    LEFT JOIN LATERAL (
      SELECT pw.window_start_day s, pw.window_end_day e2 FROM client_contracts cc
      LEFT JOIN payroll_windows pw ON pw.id = cc.payroll_window_id
      WHERE cc.unit_id = ae.unit_id AND cc.record_type = 'client' AND cc.status = 'active'
      ORDER BY cc.start_date DESC, cc.created_at DESC LIMIT 1) w ON true
    CROSS JOIN LATERAL attendance_period_bounds(w.s, w.e2, ae.entry_date) b
    WHERE ae.candidate_id = _cand
      AND ae.entry_date BETWEEN m - 45 AND m + 62
      AND date_trunc('month', b.pe)::date = m
  ),
  agg AS (
    SELECT e.unit_id,
      min(e.ps) ps, max(e.pe) pe,
      sum(CASE WHEN COALESCE(ac.counts_as_present, false) THEN COALESCE(ac.day_value, 1) ELSE 0 END) p,
      sum(COALESCE(e.ot_hours, 0)) ed,
      count(DISTINCT e.entry_date) FILTER (WHERE COALESCE(ac.counts_as_present, false) OR COALESCE(e.ot_hours, 0) > 0)::int wd,
      bool_or(NOT e.is_reliever AND (COALESCE(ac.counts_as_present, false) OR COALESCE(e.ot_hours, 0) > 0)) reg
    FROM e LEFT JOIN attendance_codes ac ON ac.code = e.code
    GROUP BY e.unit_id
  )
  SELECT a.unit_id, u.code, u.name, a.ps, a.pe,
         round(a.p, 4), round(a.ed, 4), a.wd,
         COALESCE(a.reg, false) OR a.unit_id = v_pin,
         a.unit_id = v_pin AND v_pin IS NOT NULL
  FROM agg a JOIN units u ON u.id = a.unit_id
  WHERE a.wd > 0 OR a.unit_id = _unit
  ORDER BY (COALESCE(a.reg, false) OR a.unit_id = v_pin) DESC, a.wd DESC, u.code;
END;
$function$;

REVOKE ALL ON FUNCTION public.attendance_employee_site_summary(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_employee_site_summary(uuid, uuid, date) TO authenticated;
