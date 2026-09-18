-- Reassign reporting to Shiv Prakash (31064, Operations).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.
--
-- Requested: S Loganathan (31197), Gunjan Kumar (47610).

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '31064')
WHERE employee_code IN ('31197', '47610');

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id IN (SELECT id FROM public.candidates WHERE employee_code IN ('31197', '47610'));

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code IN ('31197', '47610')
  AND m.employee_code = '31064';
