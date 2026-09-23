-- Post Pankaj Zate (49258) as the regular Security Guard at CLI4438 (L&T Hingna Rd Nagpur GL).
UPDATE public.candidates
SET role_key = 'guard', non_billable = false,
    designation_id = 'aad77ba7-98d2-44cb-a0f1-b598eed740f4'
WHERE id = '148a8ab5-7433-4f3d-bc8a-11c8bf2d859b';

DELETE FROM public.candidate_units
WHERE candidate_id = '148a8ab5-7433-4f3d-bc8a-11c8bf2d859b'
  AND unit_id <> '35d191c4-fadb-411c-b42d-aed6f5e8cd1e';

INSERT INTO public.candidate_units (candidate_id, unit_id, designation_id, is_primary, is_reliever, sort_order)
SELECT '148a8ab5-7433-4f3d-bc8a-11c8bf2d859b', '35d191c4-fadb-411c-b42d-aed6f5e8cd1e',
       'aad77ba7-98d2-44cb-a0f1-b598eed740f4', true, false, 0
WHERE NOT EXISTS (SELECT 1 FROM public.candidate_units
  WHERE candidate_id = '148a8ab5-7433-4f3d-bc8a-11c8bf2d859b'
    AND unit_id = '35d191c4-fadb-411c-b42d-aed6f5e8cd1e');

UPDATE public.candidates SET unit_id = '35d191c4-fadb-411c-b42d-aed6f5e8cd1e'
WHERE id = '148a8ab5-7433-4f3d-bc8a-11c8bf2d859b';
