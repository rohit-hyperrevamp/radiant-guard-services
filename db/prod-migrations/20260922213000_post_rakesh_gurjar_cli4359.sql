-- Rakesh Gurjar (48960) appears as a posted guard on the CLI4359 muster, but his
-- link there was created as a reliever, so the database refused his attendance.
UPDATE public.candidate_units
   SET is_primary = true, is_reliever = false,
       designation_id = COALESCE(designation_id, 'aad77ba7-98d2-44cb-a0f1-b598eed740f4')
 WHERE candidate_id = '6a29d888-9714-40de-b8ec-557b32925608'
   AND unit_id = '5c2f02e7-aab5-4863-8ae6-af7adb80634a';
