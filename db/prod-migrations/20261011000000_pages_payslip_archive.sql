-- Read-only archive of historical Pages Payroll payslips (Apr 2023 – Aug 2026).
CREATE TABLE IF NOT EXISTS public.pages_payslip_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_paysheet_id bigint NOT NULL UNIQUE,
  unit_id uuid,
  client_code text,
  client_name text,
  candidate_id uuid,
  employee_code text,
  employee_name text,
  designation_name text,
  period_year int NOT NULL,
  period_month int NOT NULL,
  period_start date,
  period_end date,
  duty numeric DEFAULT 0,
  ot numeric DEFAULT 0,
  gross numeric DEFAULT 0,
  total_deductions numeric DEFAULT 0,
  net_pay numeric DEFAULT 0,
  earnings jsonb DEFAULT '[]'::jsonb,
  deductions jsonb DEFAULT '[]'::jsonb,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pages_payslip_archive_unit_period_idx ON public.pages_payslip_archive(unit_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS pages_payslip_archive_candidate_idx ON public.pages_payslip_archive(candidate_id);
GRANT SELECT ON public.pages_payslip_archive TO authenticated;
GRANT ALL ON public.pages_payslip_archive TO service_role;
ALTER TABLE public.pages_payslip_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll viewers read archive" ON public.pages_payslip_archive;
CREATE POLICY "payroll viewers read archive" ON public.pages_payslip_archive FOR SELECT TO authenticated
  USING ((select public.is_admin_user()) OR (select public.current_user_module_access('payroll','view')));
