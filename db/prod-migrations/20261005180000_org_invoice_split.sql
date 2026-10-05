-- Invoice output rules move from contract level to organization level.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS invoice_split jsonb;
COMMENT ON COLUMN public.client_contracts.invoice_split IS 'DEPRECATED: replaced by customers.invoice_split (organization level)';
NOTIFY pgrst, 'reload schema';
