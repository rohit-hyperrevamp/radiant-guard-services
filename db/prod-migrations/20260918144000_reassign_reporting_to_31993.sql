-- Reassign reporting to Col. Umed Singh (31993, VP Operations).
-- Mirrors the operations hierarchy flow: candidates.reports_to + candidate_reporting_managers
-- (source 'operations_hierarchy'), same as the earlier reassignments.
--
-- Requested: Shiv Prakash (31064), Vikaskumar (43442), Vinay Prakash Bhosale (48290).

UPDATE public.candidates
SET reports_to = (SELECT id FROM public.candidates WHERE employee_code = '31993')
WHERE employee_code IN ('31064', '43442', '48290');

DELETE FROM public.candidate_reporting_managers
WHERE candidate_id IN (SELECT id FROM public.candidates WHERE employee_code IN ('31064', '43442', '48290'));

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, source)
SELECT c.id, m.id, 'operations_hierarchy'
FROM public.candidates c
CROSS JOIN public.candidates m
WHERE c.employee_code IN ('31064', '43442', '48290')
  AND m.employee_code = '31993';
