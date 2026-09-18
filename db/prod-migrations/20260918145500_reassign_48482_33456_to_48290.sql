-- Reassign reporting: Dileep Singh (33456) and Nagesh Ramdas Thombare (48482)
-- now report to Vinay Prakash Bhosale (48290).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '48290')
WHERE employee_code IN ('48482', '33456');

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id IN (SELECT id FROM public.candidates WHERE employee_code IN ('48482', '33456'));

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code IN ('48482', '33456')
  AND m.employee_code = '48290';
