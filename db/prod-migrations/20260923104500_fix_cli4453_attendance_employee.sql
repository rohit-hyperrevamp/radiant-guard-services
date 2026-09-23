-- CLI4453 (L&T FINANCE LTD- BANGALORE- ULLAL) : replace Suraj Sharma (47911) with Mahesh (47503)
-- Unit: 73516022-f77b-4674-a7e8-ed878cc9356e
-- Mahesh: 9139f0c9-1536-4538-9cdb-a9b420d3f15e (was primary at CLI3860, no attendance there)
-- Suraj:  b9510625-e789-4af5-a1f7-201dc6a02c0c (keeps his reliever mapping at CLI399)

BEGIN;

-- 1) Remove Suraj's posting at CLI4453
DELETE FROM candidate_units
WHERE candidate_id = 'b9510625-e789-4af5-a1f7-201dc6a02c0c'
  AND unit_id = '73516022-f77b-4674-a7e8-ed878cc9356e';

-- 2) Remove Mahesh's old primary posting (CLI3860, no attendance recorded there)
DELETE FROM candidate_units
WHERE candidate_id = '9139f0c9-1536-4538-9cdb-a9b420d3f15e'
  AND unit_id = '606bd948-682b-48b4-b558-1ac96b5aa98c';

-- 3) Post Mahesh as primary Security Guard at CLI4453
INSERT INTO candidate_units (candidate_id, unit_id, designation_id, is_primary, is_reliever)
VALUES ('9139f0c9-1536-4538-9cdb-a9b420d3f15e',
        '73516022-f77b-4674-a7e8-ed878cc9356e',
        'aad77ba7-98d2-44cb-a0f1-b598eed740f4', true, false)
ON CONFLICT DO NOTHING;

-- 4) Move the 21 Aug - 20 Sep muster at CLI4453 to Mahesh
UPDATE attendance_entries
SET candidate_id = '9139f0c9-1536-4538-9cdb-a9b420d3f15e', updated_at = now()
WHERE unit_id = '73516022-f77b-4674-a7e8-ed878cc9356e'
  AND candidate_id = 'b9510625-e789-4af5-a1f7-201dc6a02c0c';

-- 5) Keep candidates.unit_id in sync
UPDATE candidates SET unit_id = '73516022-f77b-4674-a7e8-ed878cc9356e', updated_at = now()
WHERE id = '9139f0c9-1536-4538-9cdb-a9b420d3f15e';

COMMIT;
