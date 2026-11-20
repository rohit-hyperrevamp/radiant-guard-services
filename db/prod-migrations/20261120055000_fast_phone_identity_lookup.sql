-- Check-in and most permission checks resolve the signed-in person via
-- current_user_candidate_id() (candidates.mobile = phone). The only mobile
-- index was partial (active rows), so every lookup scanned ~29k employees;
-- at the morning check-in peak this pushed requests past the 8 s limit
-- ("canceling statement due to statement timeout").
CREATE INDEX CONCURRENTLY IF NOT EXISTS candidates_mobile_lookup_idx
  ON public.candidates (mobile);

-- HR HO auto-checkout: use the partial deadline index instead of evaluating
-- the eligibility function across every open punch.
CREATE OR REPLACE FUNCTION public.arm_hr_ho_checkout()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
DECLARE _due timestamptz; _job bigint; _schedule text;
BEGIN
 PERFORM pg_advisory_xact_lock(18112026,12);
 SELECT min(p.check_in_at + interval '12 hours') INTO _due
 FROM public.self_attendance_punches p
 JOIN public.candidates c ON c.id = p.candidate_id
 WHERE p.check_out_at IS NULL AND p.check_in_at IS NOT NULL
   AND p.unit_id = '0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'::uuid
   AND p.punch_date >= DATE '2026-11-18'
   AND c.department_id = '6e453c4e-b1e2-48fa-bdab-f0c9a354c1af'::uuid;
 SELECT jobid INTO _job FROM cron.job WHERE jobname = 'hr-ho-auto-checkout';
 IF _due IS NULL THEN
   IF _job IS NOT NULL THEN PERFORM cron.unschedule(_job); END IF;
   RETURN;
 END IF;
 _due := date_trunc('minute', greatest(_due, clock_timestamp())) + interval '1 minute';
 _schedule := to_char(_due AT TIME ZONE 'UTC','MI HH24 DD MM') || ' *';
 IF _job IS NULL THEN
   PERFORM cron.schedule('hr-ho-auto-checkout',_schedule,'SELECT public.run_hr_ho_checkout();');
 ELSE
   PERFORM cron.alter_job(_job,schedule := _schedule,active := true);
 END IF;
END;
$function$;
