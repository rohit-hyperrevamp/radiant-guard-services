-- Remove employee 38735 (KALESH PRASAD) from CLI4363 (L&T FINANCE LTD - BHIWADI).
-- He was moved there by a manual edit and has no attendance at that site.

DELETE FROM public.candidate_units cu
USING public.candidates c
WHERE cu.candidate_id = c.id
  AND c.employee_code = '38735'
  AND cu.unit_id = '8c6d3c74-c4b2-4ca4-88f1-a71ab05de973';

UPDATE public.candidates
SET unit_id = NULL
WHERE employee_code = '38735'
  AND unit_id = '8c6d3c74-c4b2-4ca4-88f1-a71ab05de973';
