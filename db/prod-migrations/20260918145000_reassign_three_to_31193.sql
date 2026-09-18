-- Reassign reporting: Dilip Sukdeo Singh (19555), Narendra Narayan Tripathi (41725),
-- Sanjay Kumar Shukla (47179) now report to Lt. Col Sanjay Kadam (31193).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '31193')
WHERE employee_code IN ('41725', '47179', '19555');

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id IN (SELECT id FROM public.candidates WHERE employee_code IN ('41725', '47179', '19555'));

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code IN ('41725', '47179', '19555')
  AND m.employee_code = '31193';
