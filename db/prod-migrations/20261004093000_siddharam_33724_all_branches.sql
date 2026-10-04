-- Siddharam Shankar Pujari (33724, Finance) must see every organization, unit,
-- invoice, payroll and attendance record. Remove his Pune-only branch lock.
delete from public.employee_scope_assignments
where candidate_id = '40d394a0-a31e-4413-9b5e-0e9f3042f795'
  and scope_type = 'branch';
