-- CLI4305 (L&T FINANCE LIMITED- PUNE ALEPHATA GL)
-- EMP-102 Dnyaneshwar Dare -> 49178 Eknath Dnyaneshwar Bhandare (was primary at CLI287, no attendance)
-- EMP-103 Bhimaji          -> 45630 Machindranath Jagannath Falake (was primary at CLI340, no attendance)
BEGIN;

DELETE FROM candidate_units
WHERE unit_id = 'aa45c0a0-ac03-4403-b99d-0b109e5dc6a0'
  AND candidate_id IN ('7dfc4757-fb44-4036-8287-a37340928371','b2705714-ca08-41fb-b1e3-0aa32ca72bcd');

DELETE FROM candidate_units
WHERE (candidate_id = 'cf6a7db2-9e3b-44e3-8e77-aa853b15cf44' AND unit_id = 'b7b61de9-1439-40a1-a496-6c89d6f322ef')
   OR (candidate_id = '23f51a3a-0dc6-433d-89e3-0251b9def290' AND unit_id = '6b317765-0bb7-4dd5-bd4b-46c44037ab24');

INSERT INTO candidate_units (candidate_id, unit_id, designation_id, is_primary, is_reliever)
VALUES
  ('cf6a7db2-9e3b-44e3-8e77-aa853b15cf44','aa45c0a0-ac03-4403-b99d-0b109e5dc6a0','aad77ba7-98d2-44cb-a0f1-b598eed740f4', true, false),
  ('23f51a3a-0dc6-433d-89e3-0251b9def290','aa45c0a0-ac03-4403-b99d-0b109e5dc6a0','aad77ba7-98d2-44cb-a0f1-b598eed740f4', true, false)
ON CONFLICT DO NOTHING;

UPDATE attendance_entries SET candidate_id = 'cf6a7db2-9e3b-44e3-8e77-aa853b15cf44', updated_at = now()
WHERE unit_id = 'aa45c0a0-ac03-4403-b99d-0b109e5dc6a0' AND candidate_id = '7dfc4757-fb44-4036-8287-a37340928371';

UPDATE attendance_entries SET candidate_id = '23f51a3a-0dc6-433d-89e3-0251b9def290', updated_at = now()
WHERE unit_id = 'aa45c0a0-ac03-4403-b99d-0b109e5dc6a0' AND candidate_id = 'b2705714-ca08-41fb-b1e3-0aa32ca72bcd';

UPDATE candidates SET unit_id = 'aa45c0a0-ac03-4403-b99d-0b109e5dc6a0', role_key = 'guard', updated_at = now()
WHERE id IN ('cf6a7db2-9e3b-44e3-8e77-aa853b15cf44','23f51a3a-0dc6-433d-89e3-0251b9def290');

COMMIT;
