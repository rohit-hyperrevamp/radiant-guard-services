-- L&T Hingna Rd Nagpur GL (CLI4438, unit 35d191c4-fadb-411c-b42d-aed6f5e8cd1e):
-- a Field Officer (non-billable) was mapped as the primary Security Guard, so the
-- muster roll showed an unassignable vacant slot and nobody could be deployed.
-- Field officer oversight belongs in employee_scope_assignments, not in the
-- billable unit posting.
DELETE FROM public.candidate_units cu
USING public.candidates c
WHERE cu.candidate_id = c.id
  AND cu.unit_id = '35d191c4-fadb-411c-b42d-aed6f5e8cd1e'
  AND (c.non_billable IS TRUE OR c.role_key IN ('field_officer', 'branch_manager'));
