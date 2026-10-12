ALTER POLICY "Admins read payroll holds" ON public.payroll_processing_holds USING ((select is_admin_user()));
ALTER POLICY "Admins select payroll_runs" ON public.payroll_runs USING ((select is_admin_user()));
ALTER POLICY "Admins read additions" ON public.additions USING ((select is_admin_user()));
ALTER POLICY "Admins read deductions" ON public.deductions USING ((select is_admin_user()));
ALTER POLICY "Admins read employee_signed_documents" ON public.employee_signed_documents USING ((select is_admin_user()));
ALTER POLICY "Admins read employer contributions" ON public.employer_contributions USING ((select is_admin_user()));
ALTER POLICY "Admins read system_logs" ON public.system_logs USING ((select is_admin_user()));
