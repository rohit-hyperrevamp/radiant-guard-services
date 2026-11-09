-- Data correction by exact client IDs; preserve names, contracts and attendance.
BEGIN;
SET LOCAL lock_timeout='10s';
SELECT id FROM public.units WHERE code IN ('CLI4473','CLI3098','CLI4660','CLI4683') ORDER BY id FOR UPDATE;
CREATE TEMP TABLE swap_before AS SELECT to_jsonb(u) row_before FROM public.units u WHERE code IN ('CLI4473','CLI3098','CLI4660','CLI4683');
\copy swap_before TO '/tmp/bob_client_status_swap_20261109.jsonl'
CREATE TEMP TABLE swap_preservation AS
SELECT
  (SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY u.id),'')) FROM public.units u WHERE code NOT IN ('CLI4473','CLI3098','CLI4660','CLI4683')) other_units,
  (SELECT md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY c.id),'')) FROM public.client_contracts c WHERE unit_id IN (SELECT (row_before->>'id')::uuid FROM swap_before)) contracts,
  (SELECT md5(coalesce(string_agg(to_jsonb(a)::text,'' ORDER BY a.id),'')) FROM public.attendance_entries a WHERE unit_id IN (SELECT (row_before->>'id')::uuid FROM swap_before)) attendance;
DO $$
BEGIN
  IF (SELECT count(*) FROM swap_before) <> 4 THEN RAISE EXCEPTION 'Expected exactly four clients'; END IF;
  UPDATE public.units SET status=(CASE WHEN code IN ('CLI4473','CLI3098') THEN 'inactive' ELSE 'active' END)::public.customer_status
  WHERE code IN ('CLI4473','CLI3098','CLI4660','CLI4683');
  IF EXISTS (SELECT 1 FROM swap_before s JOIN public.units u ON u.id=(s.row_before->>'id')::uuid
    WHERE (to_jsonb(u)-ARRAY['status','updated_at']) IS DISTINCT FROM (s.row_before-ARRAY['status','updated_at'])) THEN
    RAISE EXCEPTION 'Unrelated client details changed';
  END IF;
  IF (SELECT other_units FROM swap_preservation) IS DISTINCT FROM
    (SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY u.id),'')) FROM public.units u WHERE code NOT IN ('CLI4473','CLI3098','CLI4660','CLI4683')) THEN
    RAISE EXCEPTION 'Another client changed';
  END IF;
  IF (SELECT contracts FROM swap_preservation) IS DISTINCT FROM
    (SELECT md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY c.id),'')) FROM public.client_contracts c WHERE unit_id IN (SELECT (row_before->>'id')::uuid FROM swap_before)) THEN
    RAISE EXCEPTION 'Contract changed';
  END IF;
  IF (SELECT attendance FROM swap_preservation) IS DISTINCT FROM
    (SELECT md5(coalesce(string_agg(to_jsonb(a)::text,'' ORDER BY a.id),'')) FROM public.attendance_entries a WHERE unit_id IN (SELECT (row_before->>'id')::uuid FROM swap_before)) THEN
    RAISE EXCEPTION 'Attendance changed';
  END IF;
END $$;
\ir ../tests/client-status-swap-assertions.sql
COMMIT;