-- User confirmed the visible September sheet: 25 Present + 1 Extra Duty.
-- Delete only the 17 rows belonging to three unassigned hidden employees.
BEGIN;
LOCK TABLE public.attendance_entries IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public.backup_cli2967_hidden_att_20261107
  (LIKE public.attendance_entries INCLUDING DEFAULTS);
GRANT ALL ON public.backup_cli2967_hidden_att_20261107 TO service_role;
ALTER TABLE public.backup_cli2967_hidden_att_20261107 ENABLE ROW LEVEL SECURITY;
INSERT INTO public.backup_cli2967_hidden_att_20261107
SELECT e.* FROM public.attendance_entries e
JOIN public.candidates c ON c.id=e.candidate_id
WHERE e.unit_id='f0b46d59-9183-45ee-8f33-b30526566c00'
  AND e.entry_date BETWEEN '2026-08-21' AND '2026-09-20'
  AND c.employee_code IN ('20999','29436','46470')
  AND c.unit_id IS DISTINCT FROM e.unit_id
  AND NOT EXISTS (SELECT 1 FROM public.candidate_units m WHERE m.candidate_id=c.id AND m.unit_id=e.unit_id)
  AND NOT EXISTS (SELECT 1 FROM public.employee_scope_assignments s WHERE s.candidate_id=c.id AND s.scope_type='unit' AND s.scope_id=e.unit_id::text)
  AND NOT EXISTS (SELECT 1 FROM public.backup_cli2967_hidden_att_20261107 b WHERE b.id=e.id);
DELETE FROM public.attendance_entries e
USING public.backup_cli2967_hidden_att_20261107 b
WHERE e.id=b.id AND e.unit_id='f0b46d59-9183-45ee-8f33-b30526566c00';
DO $$
DECLARE p numeric; ed numeric;
BEGIN
 SELECT coalesce(sum(CASE WHEN e.code='P' THEN 1 ELSE 0 END),0),coalesce(sum(e.ot_hours),0) INTO p,ed
 FROM public.attendance_entries e WHERE e.unit_id='f0b46d59-9183-45ee-8f33-b30526566c00' AND e.entry_date BETWEEN '2026-08-21' AND '2026-09-20';
 IF p<>25 OR ed<>1 THEN RAISE EXCEPTION 'Expected 25 Present + 1 ED, got % + %; rolling back',p,ed; END IF;
END $$;
COMMIT;