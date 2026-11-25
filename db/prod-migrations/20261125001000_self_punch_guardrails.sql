-- 20261125001000_self_punch_guardrails.sql
-- RISK: MEDIUM - apply after testing check-in / check-out with one day-shift and
--               one night-shift guard (see VERIFY).
--
-- CLOSES: A1 (guards write their own punches directly - any unit, any date - and a
--   trigger turns them into attendance_entries with no sheet-status check) and
--   A2 (trigger assumes an 8-hour shift: 12-hour guards get +0.5 ED a day; it also
--   overwrites approved / processed sheets).
--
-- 1) RLS on public.self_attendance_punches (replaces self_att_own_insert / self_att_own_update):
--    rf_self_punch_insert  WITH CHECK  admin OR (
--        candidate_id IN current_user_candidate_ids()            -- own (all rehire rows)
--        AND punch_date = IST today
--        AND public.self_punch_unit_allowed(candidate_id, unit_id))
--    rf_self_punch_update  USING  admin OR (own AND (punch_date = IST today
--                                   OR (punch_date = IST yesterday AND check_out_at IS NULL)))  -- open night shift
--                          WITH CHECK admin OR (own AND punch_date IN (IST today, IST yesterday)
--                                   AND self_punch_unit_allowed(candidate_id, unit_id))
--    self_punch_unit_allowed = unit is the person's home unit (candidates.unit_id) or a
--    candidate_units posting (primary or reliever), or the person's attendance location
--    rule is 'anywhere' (field officers by default - existing designed behaviour),
--    or unit_id is NULL (a_self_punch_default_unit fills the home unit first anyway).
--    Matches src/lib/self-attendance.ts: check-in upserts today's IST row, check-out
--    updates today's row or yesterday's still-open row (MAX_OPEN_SHIFT_HOURS = 16).
--    SELECT and admin DELETE policies are unchanged. Server jobs (HO auto-checkout,
--    SECURITY DEFINER triggers) are unaffected.
-- 2) sync_self_punch_to_attendance_entry():
--    * returns without writing when the attendance sheet covering that unit/date is
--      approved (status='approved') or its amendment is approved/processed, or the
--      payroll_runs row for that window has payroll_status/invoice_status 'processed';
--    * shift length = candidate_units.shift_hours for that posting, else the unit's
--      active client contract resource shift_hours for the person's designation,
--      else 8. P >= shift, HD >= shift/2, ED = (hours - shift)/shift in 0.5 steps
--      (same formula as before with 8 replaced by the shift);
--    * "still open today" uses IST date instead of server UTC current_date (A14).
--    Inserted row shape and ON CONFLICT target are unchanged (no shift_hours /
--    is_reliever columns written), so existing attendance lines are matched as before.
--
-- NOT CLOSED: supervisor corrections on a DRAFT sheet can still be overwritten by
--   a later punch update (needs a provenance column); GPS/selfie are still enforced
--   only by enforce_attendance_location_rule + the browser.
--
-- AFFECTED SCREENS / ROLES: guard / field-officer check-in & check-out (Dashboard,
--   My Attendance), live location updates on the punch row, attendance sheet
--   (punch-derived rows stop changing once approved).
--
-- VERIFY AFTER APPLYING:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='self_attendance_punches';
--   Guard: check in today -> ok; try (console) upsert with punch_date = 3 days ago -> RLS error;
--   try unit_id of an unrelated site -> RLS error.
--   Night guard checked in yesterday evening: check out after midnight -> ok.
--   12h guard: 12h punch -> attendance_entries code 'P', ot_hours 0 (was 0.5).
--   Approve a sheet, then edit a punch in it (admin) -> attendance_entries unchanged.

BEGIN;

SELECT review_fix_202611.snapshot_policies('20261125001000', 'public', 'self_attendance_punches');

CREATE OR REPLACE FUNCTION public.self_punch_unit_allowed(_candidate_id uuid, _unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _unit_id IS NULL
      OR EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = _candidate_id AND c.unit_id = _unit_id)
      OR EXISTS (SELECT 1 FROM public.candidate_units cu WHERE cu.candidate_id = _candidate_id AND cu.unit_id = _unit_id)
      OR COALESCE((SELECT r.mode FROM public.attendance_location_rule_for(_candidate_id) r LIMIT 1), '') = 'anywhere';
$$;
REVOKE ALL ON FUNCTION public.self_punch_unit_allowed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_punch_unit_allowed(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "self_att_own_insert" ON public.self_attendance_punches;
DROP POLICY IF EXISTS "self_att_own_update" ON public.self_attendance_punches;
DROP POLICY IF EXISTS rf_self_punch_insert ON public.self_attendance_punches;
DROP POLICY IF EXISTS rf_self_punch_update ON public.self_attendance_punches;

CREATE POLICY rf_self_punch_insert ON public.self_attendance_punches
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_user())
    OR (
      candidate_id IN (SELECT public.current_user_candidate_ids())
      AND punch_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND public.self_punch_unit_allowed(candidate_id, unit_id)
    )
  );

CREATE POLICY rf_self_punch_update ON public.self_attendance_punches
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin_user())
    OR (
      candidate_id IN (SELECT public.current_user_candidate_ids())
      AND ( punch_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
            OR (punch_date = (now() AT TIME ZONE 'Asia/Kolkata')::date - 1 AND check_out_at IS NULL) )
    )
  )
  WITH CHECK (
    (SELECT public.is_admin_user())
    OR (
      candidate_id IN (SELECT public.current_user_candidate_ids())
      AND punch_date IN ((now() AT TIME ZONE 'Asia/Kolkata')::date, (now() AT TIME ZONE 'Asia/Kolkata')::date - 1)
      AND public.self_punch_unit_allowed(candidate_id, unit_id)
    )
  );

CREATE OR REPLACE FUNCTION public.sync_self_punch_to_attendance_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _designation_id uuid;
  _hours numeric := 0;
  _code text;
  _ot_days numeric := 0;
  _shift numeric;
BEGIN
  IF NEW.unit_id IS NULL OR NEW.candidate_id IS NULL OR NEW.check_in_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Never touch a locked period: approved sheet / amendment, or processed payroll / invoice.
  IF EXISTS (
       SELECT 1 FROM public.attendance_sheets s
       WHERE s.unit_id = NEW.unit_id
         AND NEW.punch_date BETWEEN s.period_start AND s.period_end
         AND (s.status = 'approved' OR COALESCE(s.amendment_status, 'none') IN ('approved', 'processed')))
     OR EXISTS (
       SELECT 1 FROM public.payroll_runs pr
       WHERE pr.unit_id = NEW.unit_id
         AND NEW.punch_date BETWEEN pr.period_start AND pr.period_end
         AND (COALESCE(pr.payroll_status, '') = 'processed' OR COALESCE(pr.invoice_status, '') = 'processed')) THEN
    RETURN NEW;
  END IF;

  SELECT c.designation_id INTO _designation_id
  FROM public.candidates c
  WHERE c.id = NEW.candidate_id;

  -- Shift length: posting -> active contract resource for the designation -> 8.
  SELECT cu.shift_hours INTO _shift
  FROM public.candidate_units cu
  WHERE cu.candidate_id = NEW.candidate_id AND cu.unit_id = NEW.unit_id AND COALESCE(cu.shift_hours, 0) > 0
  ORDER BY cu.is_primary DESC NULLS LAST
  LIMIT 1;
  IF _shift IS NULL THEN
    SELECT cr.shift_hours INTO _shift
    FROM public.client_contracts cc
    JOIN public.contract_resources cr ON cr.contract_id = cc.id
    WHERE cc.unit_id = NEW.unit_id AND cc.record_type = 'client' AND cc.status = 'active'
      AND cr.designation_id IS NOT DISTINCT FROM _designation_id
      AND COALESCE(cr.shift_hours, 0) > 0
    ORDER BY cc.start_date DESC, cc.created_at DESC
    LIMIT 1;
  END IF;
  _shift := COALESCE(_shift, 8);

  IF NEW.check_out_at IS NULL THEN
    IF NEW.punch_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
      RETURN NEW;
    END IF;
    -- A night shift that started yesterday is still running: don't mark it
    -- Absent while the punch is open and under 16 hours old (the app's
    -- MAX_OPEN_SHIFT_HOURS window). Check-out will record the real code.
    IF NEW.check_in_at IS NOT NULL AND now() - NEW.check_in_at <= interval '16 hours' THEN
      RETURN NEW;
    END IF;
    _code := 'A';
  ELSE
    _hours := GREATEST(0, EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at))::numeric / 3600);
    IF _hours >= _shift THEN
      _code := 'P';
      _ot_days := ROUND(((GREATEST(0, _hours - _shift) / _shift) * 2)) / 2;
    ELSIF _hours >= _shift / 2 THEN
      _code := 'HD';
    ELSE
      _code := 'A';
    END IF;
  END IF;

  INSERT INTO public.attendance_entries (
    unit_id,
    candidate_id,
    designation_id,
    entry_date,
    code,
    ot_hours
  )
  VALUES (
    NEW.unit_id,
    NEW.candidate_id,
    _designation_id,
    NEW.punch_date,
    _code,
    _ot_days
  )
  ON CONFLICT ON CONSTRAINT attendance_entries_unit_cand_desig_date_unique
  DO UPDATE SET
    code = EXCLUDED.code,
    ot_hours = EXCLUDED.ot_hours,
    updated_at = now();

  RETURN NEW;
END;
$$;

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually) - exact prior definitions
-- (policies: supabase/migrations/20260726161040_ee8dbf24-...sql;
--  function: supabase/migrations/20260727184747_4c57196f-...sql).
-- Alternative for the policies: SELECT review_fix_202611.restore_policies('20261125001000','public','self_attendance_punches');
-- ======================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS rf_self_punch_insert ON public.self_attendance_punches;
-- DROP POLICY IF EXISTS rf_self_punch_update ON public.self_attendance_punches;
-- CREATE POLICY "self_att_own_insert"
--   ON public.self_attendance_punches
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     candidate_id = public.current_user_candidate_id()
--     OR public.is_admin_user()
--   );
-- CREATE POLICY "self_att_own_update"
--   ON public.self_attendance_punches
--   FOR UPDATE
--   TO authenticated
--   USING (
--     candidate_id = public.current_user_candidate_id()
--     OR public.is_admin_user()
--   )
--   WITH CHECK (
--     candidate_id = public.current_user_candidate_id()
--     OR public.is_admin_user()
--   );
-- DROP FUNCTION IF EXISTS public.self_punch_unit_allowed(uuid, uuid);
-- CREATE OR REPLACE FUNCTION public.sync_self_punch_to_attendance_entry()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   _designation_id uuid;
--   _hours numeric := 0;
--   _code text;
--   _ot_days numeric := 0;
-- BEGIN
--   IF NEW.unit_id IS NULL OR NEW.candidate_id IS NULL OR NEW.check_in_at IS NULL THEN
--     RETURN NEW;
--   END IF;
-- 
--   IF NEW.check_out_at IS NULL THEN
--     IF NEW.punch_date >= current_date THEN
--       RETURN NEW;
--     END IF;
--     _code := 'A';
--   ELSE
--     _hours := GREATEST(0, EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at))::numeric / 3600);
--     IF _hours >= 8 THEN
--       _code := 'P';
--       _ot_days := ROUND(((GREATEST(0, _hours - 8) / 8) * 2)) / 2;
--     ELSIF _hours >= 4 THEN
--       _code := 'HD';
--     ELSE
--       _code := 'A';
--     END IF;
--   END IF;
-- 
--   SELECT c.designation_id INTO _designation_id
--   FROM public.candidates c
--   WHERE c.id = NEW.candidate_id;
-- 
--   INSERT INTO public.attendance_entries (
--     unit_id,
--     candidate_id,
--     designation_id,
--     entry_date,
--     code,
--     ot_hours
--   )
--   VALUES (
--     NEW.unit_id,
--     NEW.candidate_id,
--     _designation_id,
--     NEW.punch_date,
--     _code,
--     _ot_days
--   )
--   ON CONFLICT ON CONSTRAINT attendance_entries_unit_cand_desig_date_unique
--   DO UPDATE SET
--     code = EXCLUDED.code,
--     ot_hours = EXCLUDED.ot_hours,
--     updated_at = now();
-- 
--   RETURN NEW;
-- END;
-- $$;
-- COMMIT;
