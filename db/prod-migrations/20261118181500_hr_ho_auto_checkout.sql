-- HR attendance checkout, not authentication/session expiry.
-- Corporate Office (Pune - HO), HR department; prospective from activation day.
BEGIN;
CREATE OR REPLACE FUNCTION public.hr_ho_checkout_eligible(_candidate uuid, _unit uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT _unit = '0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'::uuid
   AND _date >= DATE '2026-11-18'
   AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = _candidate
     AND c.department_id = '6e453c4e-b1e2-48fa-bdab-f0c9a354c1af'::uuid);
$$;
REVOKE ALL ON FUNCTION public.hr_ho_checkout_eligible(uuid,uuid,date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.arm_hr_ho_checkout()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE _due timestamptz; _job bigint; _schedule text;
BEGIN
 PERFORM pg_advisory_xact_lock(18112026,12);
 SELECT min(p.check_in_at + interval '12 hours') INTO _due
 FROM public.self_attendance_punches p
 WHERE p.check_out_at IS NULL AND p.check_in_at IS NOT NULL
   AND public.hr_ho_checkout_eligible(p.candidate_id,p.unit_id,p.punch_date);
 SELECT jobid INTO _job FROM cron.job WHERE jobname = 'hr-ho-auto-checkout';
 IF _due IS NULL THEN
   IF _job IS NOT NULL THEN PERFORM cron.unschedule(_job); END IF;
   RETURN;
 END IF;
 -- One next-deadline wakeup (minute precision), never an always-on sweeper.
 _due := date_trunc('minute', greatest(_due, clock_timestamp())) + interval '1 minute';
 _schedule := to_char(_due AT TIME ZONE 'UTC','MI HH24 DD MM') || ' *';
 IF _job IS NULL THEN
   PERFORM cron.schedule('hr-ho-auto-checkout',_schedule,'SELECT public.run_hr_ho_checkout();');
 ELSE
   PERFORM cron.alter_job(_job,schedule := _schedule,active := true);
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.arm_hr_ho_checkout() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_hr_ho_checkout()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
 PERFORM pg_advisory_xact_lock(18112026,12);
 UPDATE public.self_attendance_punches p
 SET check_out_at = p.check_in_at + interval '12 hours',
     notes = concat_ws(E'\n',nullif(p.notes,''),'Automatic checkout after 12 hours — HR Pune HO')
 WHERE p.check_out_at IS NULL AND p.check_in_at + interval '12 hours' <= now()
   AND public.hr_ho_checkout_eligible(p.candidate_id,p.unit_id,p.punch_date);
 GET DIAGNOSTICS _count = ROW_COUNT;
 PERFORM public.arm_hr_ho_checkout();
 RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.run_hr_ho_checkout() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hr_ho_checkout_on_punch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN
   IF public.hr_ho_checkout_eligible(OLD.candidate_id,OLD.unit_id,OLD.punch_date) THEN
     PERFORM public.arm_hr_ho_checkout(); RETURN NULL;
   END IF;
 END IF;
 IF TG_OP <> 'DELETE' THEN
   IF public.hr_ho_checkout_eligible(NEW.candidate_id,NEW.unit_id,NEW.punch_date) THEN
     PERFORM public.arm_hr_ho_checkout();
   END IF;
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.hr_ho_checkout_on_punch() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_hr_ho_checkout_schedule
AFTER INSERT OR DELETE OR UPDATE OF check_in_at,check_out_at,unit_id,candidate_id,punch_date
ON public.self_attendance_punches FOR EACH ROW EXECUTE FUNCTION public.hr_ho_checkout_on_punch();

CREATE INDEX IF NOT EXISTS self_punch_hr_ho_open_deadline
ON public.self_attendance_punches (check_in_at,candidate_id)
WHERE check_out_at IS NULL AND unit_id = '0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'::uuid
  AND punch_date >= DATE '2026-11-18';
COMMENT ON FUNCTION public.run_hr_ho_checkout() IS
'Close only HR Pune HO open punches at check-in +12h. Existing attendance sync applies. Never fabricate checkout location/photo/face proof; manual checkout is preserved. Deadline wakeup re-arms while pending and unschedules after drain.';
SELECT public.arm_hr_ho_checkout();
COMMIT;