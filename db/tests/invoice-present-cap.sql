-- Rollback-only setting persistence test: no site remains enabled.
BEGIN;
CREATE TEMP TABLE cap_attendance_before AS
SELECT count(*) AS n, md5(string_agg(md5(to_jsonb(a)::text), '' ORDER BY id)) AS checksum
FROM public.attendance_entries a;
CREATE TEMP TABLE cap_resources_before AS
SELECT id, to_jsonb(r) AS value FROM public.contract_resources r;
DO $$
DECLARE target uuid;
BEGIN
 IF EXISTS (SELECT 1 FROM public.contract_resources WHERE invoice_present_cap) THEN
   RAISE EXCEPTION 'No client should be opted in';
 END IF;
 SELECT id INTO target FROM public.contract_resources WHERE billing_day_base_id IS NOT NULL ORDER BY id LIMIT 1;
 IF target IS NULL THEN RAISE EXCEPTION 'No resource fixture'; END IF;
 UPDATE public.contract_resources SET invoice_present_cap = true WHERE id = target;
 IF NOT (SELECT invoice_present_cap FROM public.contract_resources WHERE id = target) THEN
   RAISE EXCEPTION 'Setting did not persist';
 END IF;
 IF EXISTS (SELECT 1 FROM cap_attendance_before b CROSS JOIN (
   SELECT count(*) AS n, md5(string_agg(md5(to_jsonb(a)::text), '' ORDER BY id)) AS checksum
   FROM public.attendance_entries a
 ) a WHERE a.n IS DISTINCT FROM b.n OR a.checksum IS DISTINCT FROM b.checksum) THEN
   RAISE EXCEPTION 'Invoice setting changed attendance';
 END IF;
 IF EXISTS (SELECT 1 FROM cap_resources_before b JOIN public.contract_resources r USING(id)
   WHERE (b.value - 'invoice_present_cap' - 'updated_at') IS DISTINCT FROM
     (to_jsonb(r) - 'invoice_present_cap' - 'updated_at')) THEN
   RAISE EXCEPTION 'Invoice setting changed rates or payroll';
 END IF;
END $$;
ROLLBACK;