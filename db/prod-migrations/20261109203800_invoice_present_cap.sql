-- Opt-in invoice-only setting; no clients are enabled and no attendance is rewritten.
ALTER TABLE public.contract_resources
  ADD COLUMN IF NOT EXISTS invoice_present_cap boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.contract_resources.invoice_present_cap IS
  'Invoice-only pooled Present cap per designation and duty length, using Billing Days; payroll and attendance unchanged. Disabled by default.';