-- Reassign reporting to Manish Murthy Naidu (39316, Operations).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.
--
-- Requested: Rajiv Dhondu Chambhar (38325), Ashwani Kumar (47939).

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '39316')
WHERE employee_code IN ('38325', '47939');

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id IN (SELECT id FROM public.candidates WHERE employee_code IN ('38325', '47939'));

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code IN ('38325', '47939')
  AND m.employee_code = '39316';
