-- CLI4317 (L&T Finance Limited - Nokha) muster was imported against employee
-- 47068 (Inder Singh) instead of 48001 (Anil). Move the attendance to Anil,
-- post him at CLI4317 and restore Inder Singh to his own site CLI3891
-- (Neem Ka Thana), where his attendance already exists.

-- 1. Post Anil at CLI4317 as the primary guard
INSERT INTO public.candidate_units (candidate_id, unit_id, is_primary, is_reliever, designation_id, sort_order)
VALUES ('0c10c695-26c9-4a8d-a0d5-4b3b6e4400e3', '71450d86-fe92-4e2d-9764-b0b2213829c7',
        true, false, 'aad77ba7-98d2-44cb-a0f1-b598eed740f4', 0)
ON CONFLICT DO NOTHING;

UPDATE public.candidate_units
   SET is_primary = true, is_reliever = false, updated_at = now()
 WHERE candidate_id = '0c10c695-26c9-4a8d-a0d5-4b3b6e4400e3'
   AND unit_id = '71450d86-fe92-4e2d-9764-b0b2213829c7';

UPDATE public.candidate_units
   SET is_primary = false, updated_at = now()
 WHERE candidate_id = '0c10c695-26c9-4a8d-a0d5-4b3b6e4400e3'
   AND unit_id = '039cf1d4-5e84-41ba-9928-545bb9d970b9';

UPDATE public.candidates
   SET unit_id = '71450d86-fe92-4e2d-9764-b0b2213829c7'
 WHERE id = '0c10c695-26c9-4a8d-a0d5-4b3b6e4400e3';

-- 2. Move the uploaded CLI4317 attendance from 47068 to 48001
UPDATE public.attendance_entries
   SET candidate_id = '0c10c695-26c9-4a8d-a0d5-4b3b6e4400e3',
       updated_at = now()
 WHERE unit_id = '71450d86-fe92-4e2d-9764-b0b2213829c7'
   AND candidate_id = '2473be2b-8006-47ef-8d6f-eb535e086137';

-- 3. Remove Inder Singh from CLI4317 and restore his Neem Ka Thana posting
DELETE FROM public.candidate_units
 WHERE candidate_id = '2473be2b-8006-47ef-8d6f-eb535e086137'
   AND unit_id = '71450d86-fe92-4e2d-9764-b0b2213829c7';

UPDATE public.candidate_units
   SET is_primary = true, is_reliever = false, updated_at = now()
 WHERE candidate_id = '2473be2b-8006-47ef-8d6f-eb535e086137'
   AND unit_id = '7f61424c-f90b-41aa-86dc-5135abff1306';

UPDATE public.candidates
   SET unit_id = '7f61424c-f90b-41aa-86dc-5135abff1306'
 WHERE id = '2473be2b-8006-47ef-8d6f-eb535e086137';
