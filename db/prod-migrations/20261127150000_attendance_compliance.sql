-- Attendance compliance: people whose duties in one attendance period exceed a
-- limit (default 31), across every site they worked in that period.
--
-- The period follows each site's own active contract window, exactly like the
-- attendance page (payrollPeriodForMonth): a split window such as 21-20 ending
-- in the chosen month runs 21st of the previous month to 20th of this month,
-- otherwise the calendar month. `_window` is the page's window key
-- ("<start>-<end>", e.g. "21-20") or 'all' for every site.
--
-- Duties = Present day value (P = 1, HD = 0.5) + Extra Duty days (ot_hours),
-- the same counts the attendance sheet and attendance_employee_site_summary use.
-- SECURITY INVOKER: row-level security on attendance_entries keeps scoped users
-- (field officers, branch scope) to the sites they can already see.

CREATE OR REPLACE FUNCTION public.attendance_compliance_people(
  _month date, _window text DEFAULT 'all', _min numeric DEFAULT 31)
RETURNS TABLE (
  candidate_id uuid, employee_code text, full_name text,
  duties numeric, present_days numeric, ed_days numeric,
  site_count integer, designation_count integer, reliever_duties numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH m AS (SELECT date_trunc('month', _month)::date AS m),
  w AS (
    SELECT DISTINCT ON (cc.unit_id) cc.unit_id,
           COALESCE(pw.window_start_day, 1) AS s, COALESCE(pw.window_end_day, 31) AS e
    FROM client_contracts cc
    LEFT JOIN payroll_windows pw ON pw.id = cc.payroll_window_id
    WHERE cc.record_type = 'client' AND cc.status = 'active'
    ORDER BY cc.unit_id, cc.start_date DESC, cc.created_at DESC
  ),
  p AS (
    SELECT w.unit_id,
      CASE WHEN w.s > 1 AND w.e > 0 AND w.e < w.s
           THEN LEAST((m.m - interval '1 month')::date + (w.s - 1), m.m - 1)
           ELSE m.m END AS ps,
      CASE WHEN w.s > 1 AND w.e > 0 AND w.e < w.s
           THEN LEAST(m.m + (w.e - 1), (m.m + interval '1 month - 1 day')::date)
           ELSE (m.m + interval '1 month - 1 day')::date END AS pe
    FROM w CROSS JOIN m
    WHERE COALESCE(_window, 'all') = 'all' OR (w.s || '-' || w.e) = _window
  ),
  d AS (
    SELECT ae.candidate_id, ae.unit_id, ae.designation_id, ae.is_reliever,
      CASE WHEN COALESCE(ac.counts_as_present, false) THEN COALESCE(ac.day_value, 1) ELSE 0 END AS pres,
      COALESCE(ae.ot_hours, 0) AS ed
    FROM p
    JOIN attendance_entries ae ON ae.unit_id = p.unit_id AND ae.entry_date BETWEEN p.ps AND p.pe
    LEFT JOIN attendance_codes ac ON ac.code = ae.code
  ),
  agg AS (
    SELECT d.candidate_id,
      sum(d.pres) AS pres, sum(d.ed) AS ed,
      count(DISTINCT d.unit_id) FILTER (WHERE d.pres > 0 OR d.ed > 0)::int AS sites,
      count(DISTINCT d.designation_id) FILTER (WHERE d.pres > 0 OR d.ed > 0)::int AS desigs,
      sum(d.pres + d.ed) FILTER (WHERE d.is_reliever) AS rel
    FROM d
    GROUP BY d.candidate_id
  )
  SELECT a.candidate_id, c.employee_code, c.full_name,
         round(a.pres + a.ed, 4), round(a.pres, 4), round(a.ed, 4),
         a.sites, a.desigs, round(COALESCE(a.rel, 0), 4)
  FROM agg a
  JOIN candidates c ON c.id = a.candidate_id
  WHERE a.pres + a.ed > COALESCE(_min, 31)
  ORDER BY a.pres + a.ed DESC, c.full_name;
$function$;

-- One person's breakdown for the same period: every site and designation they
-- worked, split into regular duty and reliever duty.
CREATE OR REPLACE FUNCTION public.attendance_compliance_person(
  _cand uuid, _month date, _window text DEFAULT 'all')
RETURNS TABLE (
  unit_id uuid, unit_code text, unit_name text, customer_name text,
  period_start date, period_end date,
  designation text, is_reliever boolean,
  present_days numeric, ed_days numeric, duties numeric,
  first_date date, last_date date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH m AS (SELECT date_trunc('month', _month)::date AS m),
  w AS (
    SELECT DISTINCT ON (cc.unit_id) cc.unit_id,
           COALESCE(pw.window_start_day, 1) AS s, COALESCE(pw.window_end_day, 31) AS e
    FROM client_contracts cc
    LEFT JOIN payroll_windows pw ON pw.id = cc.payroll_window_id
    WHERE cc.record_type = 'client' AND cc.status = 'active'
    ORDER BY cc.unit_id, cc.start_date DESC, cc.created_at DESC
  ),
  p AS (
    SELECT w.unit_id,
      CASE WHEN w.s > 1 AND w.e > 0 AND w.e < w.s
           THEN LEAST((m.m - interval '1 month')::date + (w.s - 1), m.m - 1)
           ELSE m.m END AS ps,
      CASE WHEN w.s > 1 AND w.e > 0 AND w.e < w.s
           THEN LEAST(m.m + (w.e - 1), (m.m + interval '1 month - 1 day')::date)
           ELSE (m.m + interval '1 month - 1 day')::date END AS pe
    FROM w CROSS JOIN m
    WHERE COALESCE(_window, 'all') = 'all' OR (w.s || '-' || w.e) = _window
  ),
  d AS (
    SELECT ae.unit_id, p.ps, p.pe, ae.designation_id, ae.is_reliever, ae.entry_date,
      CASE WHEN COALESCE(ac.counts_as_present, false) THEN COALESCE(ac.day_value, 1) ELSE 0 END AS pres,
      COALESCE(ae.ot_hours, 0) AS ed
    FROM p
    JOIN attendance_entries ae ON ae.unit_id = p.unit_id AND ae.entry_date BETWEEN p.ps AND p.pe
    LEFT JOIN attendance_codes ac ON ac.code = ae.code
    WHERE ae.candidate_id = _cand
  )
  SELECT d.unit_id, u.code, u.name, cu.name, min(d.ps), max(d.pe),
         COALESCE(dg.name, '—'), d.is_reliever,
         round(sum(d.pres), 4), round(sum(d.ed), 4), round(sum(d.pres + d.ed), 4),
         min(d.entry_date) FILTER (WHERE d.pres > 0 OR d.ed > 0),
         max(d.entry_date) FILTER (WHERE d.pres > 0 OR d.ed > 0)
  FROM d
  JOIN units u ON u.id = d.unit_id
  LEFT JOIN customers cu ON cu.id = u.customer_id
  LEFT JOIN designations dg ON dg.id = d.designation_id
  GROUP BY d.unit_id, u.code, u.name, cu.name, dg.name, d.is_reliever
  HAVING sum(d.pres + d.ed) > 0
  ORDER BY sum(d.pres + d.ed) DESC, u.code, d.is_reliever;
$function$;

REVOKE ALL ON FUNCTION public.attendance_compliance_people(date, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attendance_compliance_person(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_compliance_people(date, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_compliance_person(uuid, date, text) TO authenticated;
