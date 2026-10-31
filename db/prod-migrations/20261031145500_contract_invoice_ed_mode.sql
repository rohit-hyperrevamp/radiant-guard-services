-- How a contract's invoice shows Extra Duty:
--   combined          P Days + ED billed as one duty total (default)
--   separate_lines    P Days line + Extra Duty line (hours × ED rate) on the same invoice
--   separate_invoice  P Days invoice + a separate Extra Duty invoice
ALTER TABLE public.client_contracts ADD COLUMN IF NOT EXISTS invoice_ed_mode text;
ALTER TABLE public.client_contracts DROP CONSTRAINT IF EXISTS client_contracts_invoice_ed_mode_chk;
ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_invoice_ed_mode_chk
  CHECK (invoice_ed_mode IS NULL OR invoice_ed_mode = ANY (ARRAY['combined','separate_lines','separate_invoice']));
-- Contracts that already bill ED on its own invoice part keep doing so.
UPDATE public.client_contracts SET invoice_ed_mode = 'separate_invoice'
 WHERE invoice_ed_mode IS NULL AND invoice_split->'assign'->>'ed' IS NOT NULL
   AND invoice_split->'assign'->>'ed' <> coalesce(invoice_split->'assign'->>'regular','main');
