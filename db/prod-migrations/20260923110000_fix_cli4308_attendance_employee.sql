-- CLI4308 (L&T Finance Ltd - Rajajinagar) muster was imported against employee
-- 44212 (S A Dhangada) instead of 48056 (L P Chidananda). Move the attendance to
-- Chidananda, post him at CLI4308 as the primary guard and swap Dhangada to
-- Chidananda's Jaya Nagar (CLI3860) posting.

-- 1. Post L P Chidananda (48056) at CLI4308 as the primary guard
INSERT INTO public.candidate_units (candidate_id, unit_id, is_primary, is_reliever, designation_id, sort_order)
SELECT '0611a3b2-f27b-4141-9432-4d2329e2f3f4', '4c8374dd-3136-4032-b477-5f47859e6ed8',
       true, false, cu.designation_id, 0
  FROM public.candidate_units cu
 WHERE cu.candidate_id = 'e9403d6a-c993-443a-a07c-b2dce7d571cf'
   AND cu.unit_id = '4c8374dd-3136-4032-b477-5f47859e6ed8'
 LIMIT 1
ON CONFLICT DO NOTHING;

UPDATE public.candidate_units
   SET is_primary = true, is_reliever = false, updated_at = now()
 WHERE candidate_id = '0611a3b2-f27b-4141-9432-4d2329e2f3f4'
   AND unit_id = '4c8374dd-3136-4032-b477-5f47859e6ed8';

UPDATE public.candidates
   SET unit_id = '4c8374dd-3136-4032-b477-5f47859e6ed8'
 WHERE id = '0611a3b2-f27b-4141-9432-4d2329e2f3f4';

-- 2. Move the uploaded CLI4308 attendance from 44212 to 48056
UPDATE public.attendance_entries
   SET candidate_id = '0611a3b2-f27b-4141-9432-4d2329e2f3f4',
       updated_at = now()
 WHERE unit_id = '4c8374dd-3136-4032-b477-5f47859e6ed8'
   AND candidate_id = 'e9403d6a-c993-443a-a07c-b2dce7d571cf';

-- 3. Remove Dhangada from CLI4308 and give him the Jaya Nagar (CLI3860) posting
DELETE FROM public.candidate_units
 WHERE candidate_id = 'e9403d6a-c993-443a-a07c-b2dce7d571cf'
   AND unit_id = '4c8374dd-3136-4032-b477-5f47859e6ed8';

DELETE FROM public.candidate_units
 WHERE candidate_id = '0611a3b2-f27b-4141-9432-4d2329e2f3f4'
   AND unit_id = '606bd948-682b-48b4-b558-1ac96b5aa98c';

INSERT INTO public.candidate_units (candidate_id, unit_id, is_primary, is_reliever, sort_order)
VALUES ('e9403d6a-c993-443a-a07c-b2dce7d571cf', '606bd948-682b-48b4-b558-1ac96b5aa98c', true, false, 0)
ON CONFLICT DO NOTHING;

UPDATE public.candidates
   SET unit_id = '606bd948-682b-48b4-b558-1ac96b5aa98c'
 WHERE id = 'e9403d6a-c993-443a-a07c-b2dce7d571cf';
