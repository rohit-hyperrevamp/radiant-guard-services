-- Reassign reporting to Col. Umed Singh (31993, VP Operations).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.
--
-- Requested: Shiv Prakash (31064), Vikaskumar (43442), Vinay Prakash Bhosale (48290).

WITH mgr AS (
  SELECT id FROM public.candidates WHERE employee_code = '31993'
),
upd AS (
  UPDATE public.candidates c
  SET reports_to = mgr.id
  FROM mgr
  WHERE c.employee_code IN ('31064', '43442', '48290')
  RETURNING c.id
)
-- replace existing reporting-manager links for these candidates
DELETE FROM public.candidate_reporting_managers crm
USING upd
WHERE crm.candidate_id = upd.id;

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, mgr.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN mgr
WHERE c.employee_code IN ('31064', '43442', '48290')
  AND NOT EXISTS (
    SELECT 1 FROM public.candidate_reporting_managers crm
    WHERE crm.candidate_id = c.id AND crm.manager_id = mgr.id
  );
