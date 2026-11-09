-- Reactivate the exact requested client only. Billing and attendance are unchanged.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT id FROM public.units WHERE id='3e252135-eab1-4cf6-8fec-8b616a12e859' AND code='CLI3431' FOR UPDATE;
CREATE TEMP TABLE cli3431_before AS SELECT to_jsonb(u) row_before FROM public.units u WHERE code='CLI3431';
\copy cli3431_before TO '/tmp/cli3431_reactivation_before_20261109.jsonl'
CREATE TEMP TABLE cli3431_preserve AS SELECT
 (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.client_contracts c WHERE unit_id='3e252135-eab1-4cf6-8fec-8b616a12e859') contracts,
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r JOIN public.client_contracts c ON c.id=r.contract_id WHERE c.unit_id='3e252135-eab1-4cf6-8fec-8b616a12e859') resources,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attendance_entries a WHERE unit_id='3e252135-eab1-4cf6-8fec-8b616a12e859') attendance;
UPDATE public.units SET status='active' WHERE id='3e252135-eab1-4cf6-8fec-8b616a12e859' AND code='CLI3431';
DO $$
BEGIN
 IF (SELECT count(*) FROM cli3431_before)<>1 THEN RAISE EXCEPTION 'Expected exactly CLI3431'; END IF;
 IF (SELECT to_jsonb(u)-ARRAY['status','updated_at'] FROM public.units u WHERE code='CLI3431') IS DISTINCT FROM
    (SELECT row_before-ARRAY['status','updated_at'] FROM cli3431_before) THEN RAISE EXCEPTION 'Unrelated client fields changed'; END IF;
 IF (SELECT contracts FROM cli3431_preserve) IS DISTINCT FROM
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.client_contracts c WHERE unit_id='3e252135-eab1-4cf6-8fec-8b616a12e859') THEN RAISE EXCEPTION 'Contract changed'; END IF;
 IF (SELECT resources FROM cli3431_preserve) IS DISTINCT FROM
    (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r JOIN public.client_contracts c ON c.id=r.contract_id WHERE c.unit_id='3e252135-eab1-4cf6-8fec-8b616a12e859') THEN RAISE EXCEPTION 'Rates changed'; END IF;
 IF (SELECT attendance FROM cli3431_preserve) IS DISTINCT FROM
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attendance_entries a WHERE unit_id='3e252135-eab1-4cf6-8fec-8b616a12e859') THEN RAISE EXCEPTION 'Attendance changed'; END IF;
END $$;
\ir ../tests/cli3431-active-assertions.sql
COMMIT;