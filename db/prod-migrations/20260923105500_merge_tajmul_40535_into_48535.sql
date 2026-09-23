-- Merge duplicate employee record: Tajmul Hussain Barbhuiya 40535 (auto-created, empty details)
-- into the complete record Tojmul Hussain Barbhuiya 48535.
-- Keep 48535; move the CLI4309 (L&T Banashankari) posting and its 21 Aug - 20 Sep muster onto it.
-- 40535: 71113f51-bd8c-4acf-b6ad-ed5d167023b3
-- 48535: 38bb553b-552d-4fc9-9da2-40374f65d791
-- CLI4309 unit: d8c946fb-8882-44db-adf4-360c6ba02f73 ; CLI1260 unit: d5d385b3-7527-4fc5-886b-d3d787b13118

BEGIN;

-- 1) Drop the old stand-in postings (the duplicate's CLI4309 row and 48535's CLI1260 row)
DELETE FROM candidate_units
WHERE candidate_id IN ('71113f51-bd8c-4acf-b6ad-ed5d167023b3',
                       '38bb553b-552d-4fc9-9da2-40374f65d791');

-- 2) Post 48535 as primary Security Guard at CLI4309
INSERT INTO candidate_units (candidate_id, unit_id, designation_id, is_primary, is_reliever)
VALUES ('38bb553b-552d-4fc9-9da2-40374f65d791',
        'd8c946fb-8882-44db-adf4-360c6ba02f73',
        'aad77ba7-98d2-44cb-a0f1-b598eed740f4', true, false)
ON CONFLICT DO NOTHING;

-- 3) Move attendance from the duplicate to 48535
UPDATE attendance_entries
SET candidate_id = '38bb553b-552d-4fc9-9da2-40374f65d791', updated_at = now()
WHERE candidate_id = '71113f51-bd8c-4acf-b6ad-ed5d167023b3';

-- 4) Point the surviving record's home unit at CLI4309
UPDATE candidates
SET unit_id = 'd8c946fb-8882-44db-adf4-360c6ba02f73', updated_at = now()
WHERE id = '38bb553b-552d-4fc9-9da2-40374f65d791';

-- 5) Remove the duplicate record and its stale scope row
DELETE FROM field_officer_scope WHERE candidate_id = '71113f51-bd8c-4acf-b6ad-ed5d167023b3';
DELETE FROM candidates WHERE id = '71113f51-bd8c-4acf-b6ad-ed5d167023b3';

COMMIT;
