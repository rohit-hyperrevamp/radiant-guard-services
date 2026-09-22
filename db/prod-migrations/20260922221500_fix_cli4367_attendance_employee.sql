-- CLI4367 (L&T Finance Ltd - Mandore) muster was imported against employee 49201
-- (Pooran Singh Bhati) instead of 48284 (Hanuvant Singh).
-- Move the attendance to Hanuvant Singh, keep him posted at CLI4367 and restore
-- Pooran Singh Bhati to his own site CLI2063 (Bajaj Financial Securities - Jaipur).

-- 1. Hanuvant Singh stays the primary guard at CLI4367
UPDATE public.candidate_units
   SET is_primary = true,
       is_reliever = false,
       updated_at = now()
 WHERE candidate_id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5'
   AND unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9';

UPDATE public.candidates
   SET unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9'
 WHERE id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5';

-- 2. Re-assign the uploaded CLI4367 attendance to Hanuvant Singh
UPDATE public.attendance_entries
   SET candidate_id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5',
       updated_at = now()
 WHERE unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9'
   AND candidate_id = 'cb097d63-120e-430f-8983-e4c57970dbca';

-- 3. Remove the wrong guard's CLI4367 posting and restore his own site
DELETE FROM public.candidate_units
 WHERE candidate_id = 'cb097d63-120e-430f-8983-e4c57970dbca'
   AND unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9';

INSERT INTO public.candidate_units (candidate_id, unit_id, is_primary, is_reliever, sort_order)
VALUES ('cb097d63-120e-430f-8983-e4c57970dbca', '217f0354-b226-40ea-9bf2-ae871f3c76d7', true, false, 0)
ON CONFLICT DO NOTHING;

UPDATE public.candidates
   SET unit_id = '217f0354-b226-40ea-9bf2-ae871f3c76d7'
 WHERE id = 'cb097d63-120e-430f-8983-e4c57970dbca';
