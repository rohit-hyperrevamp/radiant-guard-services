-- User request: remove unused client CLI3631 (BFL Vadodara Old Channi Road MFI GL) and contract CON14467.
-- No attendance, payroll, punches or employees linked.
begin;
delete from public.contract_resources where contract_id='9f0c8136-82eb-46e8-950c-88f1b6e1ebf1';
delete from public.client_contracts where id='9f0c8136-82eb-46e8-950c-88f1b6e1ebf1';
delete from public.field_visit_requests where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.field_visits where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.candidate_reporting_managers where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.attendance_scan_jobs where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.mis_unit_values where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.invoice_number_client_tokens where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.final_invoice_units where unit_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.employee_scope_assignments where scope_id='50ecb12e-3102-4587-be85-965e00fa4f9d';
delete from public.units where id='50ecb12e-3102-4587-be85-965e00fa4f9d';
commit;
