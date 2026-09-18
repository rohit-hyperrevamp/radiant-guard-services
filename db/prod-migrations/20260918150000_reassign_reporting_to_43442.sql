-- Reassign reporting to Vikaskumar (43442, Operations).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.
--
-- Requested: Rohitdan Haridan Barot (46123), Parmar Vasantkumar Nathalal (48597).

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '43442')
WHERE employee_code IN ('46123', '48597');

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id IN (SELECT id FROM public.candidates WHERE employee_code IN ('46123', '48597'));

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code IN ('46123', '48597')
  AND m.employee_code = '43442';
