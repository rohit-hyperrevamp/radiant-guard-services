-- Correction to 20260922221500: at CLI4367 (L&T Finance Ltd - Mandore)
-- Pooran Singh Bhati (49201) was the correct guard; the wrongly imported line was
-- Patel Vipulkumar Mulsinh (49284), which belongs to Hanuvant Singh (48284).

-- 1. Give the 25-day line back to Pooran Singh Bhati at CLI4367
UPDATE public.attendance_entries
   SET candidate_id = 'cb097d63-120e-430f-8983-e4c57970dbca',
       updated_at = now()
 WHERE unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9'
   AND candidate_id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5';

DELETE FROM public.candidate_units
 WHERE candidate_id = 'cb097d63-120e-430f-8983-e4c57970dbca'
   AND unit_id = '217f0354-b226-40ea-9bf2-ae871f3c76d7';

INSERT INTO public.candidate_units (candidate_id, unit_id, is_primary, is_reliever, sort_order)
VALUES ('cb097d63-120e-430f-8983-e4c57970dbca', '2158c5bf-b756-4264-8375-42c87e8434b9', true, false, 0)
ON CONFLICT DO NOTHING;

UPDATE public.candidates
   SET unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9'
 WHERE id = 'cb097d63-120e-430f-8983-e4c57970dbca';

-- 2. Move the other line (imported as 49284) to Hanuvant Singh, posted at CLI4367
UPDATE public.attendance_entries
   SET candidate_id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5',
       updated_at = now()
 WHERE unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9'
   AND candidate_id = '40917dde-4bbd-4a24-b862-44997943ab14';

UPDATE public.candidate_units
   SET is_primary = true,
       is_reliever = false,
       updated_at = now()
 WHERE candidate_id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5'
   AND unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9';

UPDATE public.candidates
   SET unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9'
 WHERE id = 'c41c29f3-d59e-495e-baa8-fba5bf63cde5';

-- 3. Remove Patel Vipulkumar Mulsinh from CLI4367 and restore his own site
DELETE FROM public.candidate_units
 WHERE candidate_id = '40917dde-4bbd-4a24-b862-44997943ab14'
   AND unit_id = '2158c5bf-b756-4264-8375-42c87e8434b9';

INSERT INTO public.candidate_units (candidate_id, unit_id, is_primary, is_reliever, sort_order)
VALUES ('40917dde-4bbd-4a24-b862-44997943ab14', 'f49f716b-b7aa-427c-9912-296ee8d14279', true, false, 0)
ON CONFLICT DO NOTHING;
