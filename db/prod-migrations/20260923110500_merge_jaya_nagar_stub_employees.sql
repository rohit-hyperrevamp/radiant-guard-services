-- Jaya Nagar (unit 2fec37ac-cb26-4203-bef8-4aae9231abef) auto-created stub records
-- merged into their real employee files:
--   "4678048629" Shiroppa (5af168df-45ce-46da-a9fa-4f4728b40bfd) -> 48629 Shivappa Duragappa Bhajantri (71697abe-6b2d-4251-b033-9661ba6a7746)
--   "EMP-105" chandro Bahadur (a05c2aee-9535-4c40-8eb7-17699271369d) -> 46780 Chandra Bahadur Thapa (e7302ca5-6ecd-49f3-8c62-fe958cfe7e16)
-- Both real employees keep their existing primary postings; Jaya Nagar is added as an
-- additional (non-reliever) posting so the muster there stays as recorded.

BEGIN;

-- 1) Additional Jaya Nagar postings for the real employees
INSERT INTO candidate_units (candidate_id, unit_id, designation_id, is_primary, is_reliever)
VALUES ('71697abe-6b2d-4251-b033-9661ba6a7746', '2fec37ac-cb26-4203-bef8-4aae9231abef',
        'aad77ba7-98d2-44cb-a0f1-b598eed740f4', false, false),
       ('e7302ca5-6ecd-49f3-8c62-fe958cfe7e16', '2fec37ac-cb26-4203-bef8-4aae9231abef',
        'aad77ba7-98d2-44cb-a0f1-b598eed740f4', false, false)
ON CONFLICT (candidate_id, unit_id) DO UPDATE
  SET is_reliever = false,
      designation_id = EXCLUDED.designation_id;

-- 2) Move the Jaya Nagar muster onto the real employees
UPDATE attendance_entries
SET candidate_id = '71697abe-6b2d-4251-b033-9661ba6a7746', updated_at = now()
WHERE candidate_id = '5af168df-45ce-46da-a9fa-4f4728b40bfd';

UPDATE attendance_entries
SET candidate_id = 'e7302ca5-6ecd-49f3-8c62-fe958cfe7e16', updated_at = now()
WHERE candidate_id = 'a05c2aee-9535-4c40-8eb7-17699271369d';

-- 3) Remove the stub records and their postings
DELETE FROM candidate_units
WHERE candidate_id IN ('5af168df-45ce-46da-a9fa-4f4728b40bfd',
                       'a05c2aee-9535-4c40-8eb7-17699271369d');

DELETE FROM candidate_designations
WHERE candidate_id IN ('5af168df-45ce-46da-a9fa-4f4728b40bfd',
                       'a05c2aee-9535-4c40-8eb7-17699271369d');

DELETE FROM candidate_reporting_managers
WHERE candidate_id IN ('5af168df-45ce-46da-a9fa-4f4728b40bfd',
                       'a05c2aee-9535-4c40-8eb7-17699271369d');

DELETE FROM field_officer_scope
WHERE candidate_id IN ('5af168df-45ce-46da-a9fa-4f4728b40bfd',
                       'a05c2aee-9535-4c40-8eb7-17699271369d');

DELETE FROM candidates
WHERE id IN ('5af168df-45ce-46da-a9fa-4f4728b40bfd',
             'a05c2aee-9535-4c40-8eb7-17699271369d');

COMMIT;
