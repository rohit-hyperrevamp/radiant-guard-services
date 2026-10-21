-- Production regression: use an existing CLI4096 converted cell and roll back
-- every attendance, posting, audit and primary-unit change after each check.
BEGIN;
DO $$
DECLARE v_id uuid; v_cand uuid; v_date date; v_code text; v_ot numeric;
BEGIN
  SELECT ae.id, ae.candidate_id, ae.entry_date INTO v_id, v_cand, v_date
  FROM public.attendance_entries ae JOIN public.units u ON u.id = ae.unit_id
  WHERE u.code = 'CLI4096' AND ae.rule_applied AND ae.ed_from_cap
    AND ae.entry_date BETWEEN '2026-09-01' AND '2026-09-30'
  ORDER BY ae.entry_date DESC LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Missing CLI4096 converted attendance fixture'; END IF;
  UPDATE public.attendance_entries SET code = 'A', ot_hours = 0, ed_from_cap = false WHERE id = v_id;
  PERFORM public.apply_guard_attendance_rules(v_cand, v_date, v_date);
  SELECT code, ot_hours INTO v_code, v_ot FROM public.attendance_entries WHERE id = v_id;
  IF v_code IS DISTINCT FROM 'A' OR v_ot IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Absent correction reverted: code %, ED %', v_code, v_ot;
  END IF;
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE v_id uuid; v_cand uuid; v_date date; v_code text; v_ot numeric; v_total numeric; v_cap numeric;
BEGIN
  SELECT ae.id, ae.candidate_id, ae.entry_date INTO v_id, v_cand, v_date
  FROM public.attendance_entries ae JOIN public.units u ON u.id = ae.unit_id
  WHERE u.code = 'CLI4096' AND ae.rule_applied AND ae.ed_from_cap
    AND ae.entry_date BETWEEN '2026-09-01' AND '2026-09-30'
  ORDER BY ae.entry_date DESC LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Missing CLI4096 converted attendance fixture'; END IF;
  UPDATE public.attendance_entries SET code = '', ot_hours = 0, ed_from_cap = false WHERE id = v_id;
  PERFORM public.apply_guard_attendance_rules(v_cand, v_date, v_date);
  SELECT code, ot_hours INTO v_code, v_ot FROM public.attendance_entries WHERE id = v_id;
  IF v_code IS DISTINCT FROM '' OR v_ot IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Clearing Extra Duty reverted: code %, ED %', v_code, v_ot;
  END IF;
  SELECT coalesce(sum(coalesce(ac.day_value, 1)),0) INTO v_total
  FROM public.attendance_entries ae JOIN public.attendance_codes ac ON ac.code=ae.code AND ac.counts_as_present
  WHERE ae.candidate_id=v_cand AND ae.unit_id='41887f48-31ea-48ef-9005-24c81a21fc93'
    AND ae.entry_date BETWEEN '2026-09-01' AND '2026-09-30';
  v_cap := public.present_cap_for_period(
    (SELECT payroll_day_base_id FROM public.contract_resources WHERE id='c9164fef-7384-4db3-bb75-5501b2d82038'),
    '2026-09-01','2026-09-30');
  IF v_cap IS NULL OR v_total > v_cap THEN RAISE EXCEPTION 'Payroll cap violated: % > %',v_total,v_cap; END IF;
END $$;
ROLLBACK;