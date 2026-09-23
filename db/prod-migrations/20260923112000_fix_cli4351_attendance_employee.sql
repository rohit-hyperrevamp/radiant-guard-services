-- CLI4351 (L&T FINANCE LIMITED- MUDALAPALYA): swap mapped employee 48050 -> 48056
-- 48056 (L P Chidananda) is posted at both CLI4308 (Rajajinagar) and CLI4351.
-- DB rules allow only one primary posting per guard, so CLI4351 becomes his
-- primary posting and CLI4308 stays as an additional (extra-duty) posting. 48050 (Suvadra Singh) is
-- removed from CLI4351 and falls back to the Radiant Pune home unit.

begin;

-- 1. Secondary posting for 48056 at CLI4351 (Security Guard designation)
insert into candidate_units (candidate_id, unit_id, is_primary, is_reliever, designation_id)
values (
  '0611a3b2-f27b-4141-9432-4d2329e2f3f4',
  '78e0be4f-92fe-4f02-9cd6-e6d73f0d381c',
  true,
  false,
  'aad77ba7-98d2-44cb-a0f1-b598eed740f4'
)
on conflict (candidate_id, unit_id) do update
  set is_primary = true,
      is_reliever = false,
      designation_id = excluded.designation_id;

-- 2. Move all CLI4351 attendance from 48050 to 48056
update attendance_entries
   set candidate_id = '0611a3b2-f27b-4141-9432-4d2329e2f3f4',
       designation_id = 'aad77ba7-98d2-44cb-a0f1-b598eed740f4'
 where unit_id = '78e0be4f-92fe-4f02-9cd6-e6d73f0d381c'
   and candidate_id = 'b9e263be-ca33-46ed-a073-3331f6ff766c';

-- 3. Remove 48050 from CLI4351 and restore his home unit
delete from candidate_units
 where candidate_id = 'b9e263be-ca33-46ed-a073-3331f6ff766c'
   and unit_id = '78e0be4f-92fe-4f02-9cd6-e6d73f0d381c';

update candidate_units
   set is_primary = true,
       is_reliever = false
 where candidate_id = 'b9e263be-ca33-46ed-a073-3331f6ff766c'
   and unit_id = '3248c96e-a242-4eb8-ba5d-f657376679a1';

update candidates
   set unit_id = '3248c96e-a242-4eb8-ba5d-f657376679a1'
 where id = 'b9e263be-ca33-46ed-a073-3331f6ff766c';

commit;
