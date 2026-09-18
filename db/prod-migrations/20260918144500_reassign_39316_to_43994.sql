-- Reassign reporting: Manish Murthy Naidu (39316) now reports to Jayesh Nathuram Chauhan (43994).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '43994')
WHERE employee_code = '39316';

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id = (SELECT id FROM public.candidates WHERE employee_code = '39316');

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code = '39316'
  AND m.employee_code = '43994';
