-- User-requested correction: IDBI October entries existed without sheet rows.
-- Only create missing sheets with saved attendance; preserve existing approvals.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE idbi_october_targets ON COMMIT DROP AS
SELECT u.id AS unit_id
FROM public.units u
WHERE u.customer_id = '5ae41c89-0566-4786-939c-d36081acb745'
  AND u.status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.attendance_entries e
    WHERE e.unit_id = u.id
      AND e.entry_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-31'
  );

DO $$
BEGIN
  IF (SELECT count(*) FROM idbi_october_targets) <> 37 THEN
    RAISE EXCEPTION 'Expected exactly 37 IDBI sites with saved October attendance';
  END IF;
END $$;

CREATE TEMP TABLE idbi_october_entries_before ON COMMIT DROP AS
SELECT e.* FROM public.attendance_entries e
JOIN idbi_october_targets t ON t.unit_id = e.unit_id
WHERE e.entry_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-31';

CREATE TEMP TABLE idbi_october_existing_before ON COMMIT DROP AS
SELECT s.* FROM public.attendance_sheets s
JOIN idbi_october_targets t ON t.unit_id = s.unit_id
WHERE s.period_start = DATE '2026-10-01' AND s.period_end = DATE '2026-10-31';

CREATE TEMP TABLE idbi_october_created (id uuid PRIMARY KEY) ON COMMIT DROP;
WITH added AS (
  INSERT INTO public.attendance_sheets
    (unit_id, period_start, period_end, status, submitted_at)
  SELECT t.unit_id, DATE '2026-10-01', DATE '2026-10-31', 'submitted', clock_timestamp()
  FROM idbi_october_targets t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_sheets s
    WHERE s.unit_id = t.unit_id
      AND s.period_start = DATE '2026-10-01' AND s.period_end = DATE '2026-10-31'
  )
  ON CONFLICT (unit_id, period_start, period_end) DO NOTHING
  RETURNING id
)
INSERT INTO idbi_october_created SELECT id FROM added;

-- This administrative correction has no signed-in actor; do not attribute it
-- to another person's account. Existing audit triggers record both transitions.
UPDATE public.attendance_sheets s
SET status = 'approved', approved_at = clock_timestamp()
FROM idbi_october_created n
WHERE s.id = n.id AND s.status = 'submitted';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM idbi_october_targets t
    LEFT JOIN public.attendance_sheets s ON s.unit_id = t.unit_id
      AND s.period_start = DATE '2026-10-01' AND s.period_end = DATE '2026-10-31'
    WHERE s.status IS DISTINCT FROM 'approved'
      OR s.submitted_at IS NULL OR s.approved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not all 37 saved IDBI October attendance sheets are submitted and approved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM idbi_october_existing_before b
    LEFT JOIN public.attendance_sheets s ON s.id = b.id
    WHERE to_jsonb(s) IS DISTINCT FROM to_jsonb(b)
  ) THEN
    RAISE EXCEPTION 'An existing IDBI approval was changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM idbi_october_entries_before b
    FULL JOIN (
      SELECT e.* FROM public.attendance_entries e
      JOIN idbi_october_targets t ON t.unit_id = e.unit_id
      WHERE e.entry_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-31'
    ) a ON a.id = b.id
    WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(b)
  ) THEN
    RAISE EXCEPTION 'Saved attendance entries were changed';
  END IF;
  RAISE NOTICE 'Verified 37 approved IDBI October sheets; existing approvals and attendance entries unchanged';
END $$;

SELECT count(*) AS newly_submitted_and_approved FROM idbi_october_created;
COMMIT;