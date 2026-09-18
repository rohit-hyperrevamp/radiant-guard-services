BEGIN;
UPDATE public.candidates AS candidate
SET role_key = 'vp_operations', reports_to = leader.id, updated_at = now()
FROM public.candidates AS leader
WHERE candidate.employee_code = '31193'
  AND leader.employee_code = '31993'
  AND (candidate.role_key IS DISTINCT FROM 'vp_operations' OR candidate.reports_to IS DISTINCT FROM leader.id);

DELETE FROM public.candidate_reporting_managers AS relationship
USING public.candidates AS candidate
WHERE candidate.employee_code = '31193'
  AND relationship.candidate_id = candidate.id
  AND relationship.is_primary = true;

INSERT INTO public.candidate_reporting_managers (candidate_id, manager_id, is_primary, source)
SELECT candidate.id, leader.id, true, 'operations_hierarchy'
FROM public.candidates AS candidate
CROSS JOIN public.candidates AS leader
WHERE candidate.employee_code = '31193' AND leader.employee_code = '31993'
ON CONFLICT (candidate_id, manager_id)
DO UPDATE SET is_primary = true, source = EXCLUDED.source;
COMMIT;
