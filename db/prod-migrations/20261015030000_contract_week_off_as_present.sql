-- Per-contract switch: count Weekly Off (WO) marks as Present days in payroll and invoices.
ALTER TABLE public.client_contracts ADD COLUMN IF NOT EXISTS wo_as_present boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.client_contracts.wo_as_present IS 'When true, WO (Weekly Off With Pay) attendance counts as a Present day for payroll and billing.';
NOTIFY pgrst, 'reload schema';
