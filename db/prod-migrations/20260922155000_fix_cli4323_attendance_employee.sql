-- CLI4323 (L&T Finance Ltd - Jodhpur - Chopasni Road) September muster was imported
-- against employee 44909 (Pradnya Kishor Bhalerao) instead of 44989 (Ram Prakash Srivastava).
-- Move the attendance to the correct guard, post him at CLI4323 and restore 44909 to CLI318.

-- 1. Post Ram Prakash Srivastava (44989) at CLI4323 as the primary guard
UPDATE public.candidate_units
   SET unit_id = '6ff45cfe-2283-4c4b-9140-12d8dc305768',
       is_primary = true,
       is_reliever = false,
       updated_at = now()
 WHERE candidate_id = '828b241b-abfa-4d15-b9ea-1325fe18e107'
   AND unit_id = '81de1bd0-51a3-4875-9edd-0a1801a26c64';

UPDATE public.candidates
   SET unit_id = '6ff45cfe-2283-4c4b-9140-12d8dc305768'
 WHERE id = '828b241b-abfa-4d15-b9ea-1325fe18e107';

-- 2. Remove the wrong guard's CLI4323 posting and restore her CLI318 primary posting
DELETE FROM public.candidate_units
 WHERE candidate_id = '94b692b8-395e-4223-ba7a-4785f0276d72'
   AND unit_id = '6ff45cfe-2283-4c4b-9140-12d8dc305768';

UPDATE public.candidate_units
   SET is_primary = true,
       is_reliever = false,
       updated_at = now()
 WHERE candidate_id = '94b692b8-395e-4223-ba7a-4785f0276d72'
   AND unit_id = '21fc0123-cc0f-4117-9ce1-2076a756090c';

UPDATE public.candidates
   SET unit_id = '21fc0123-cc0f-4117-9ce1-2076a756090c'
 WHERE id = '94b692b8-395e-4223-ba7a-4785f0276d72';

-- 3. Re-assign the uploaded CLI4323 attendance to the correct guard
UPDATE public.attendance_entries
   SET candidate_id = '828b241b-abfa-4d15-b9ea-1325fe18e107',
       updated_at = now()
 WHERE unit_id = '6ff45cfe-2283-4c4b-9140-12d8dc305768'
   AND candidate_id = '94b692b8-395e-4223-ba7a-4785f0276d72';
