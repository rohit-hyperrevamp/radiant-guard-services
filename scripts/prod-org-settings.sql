-- Company profile used by the tax invoice (header, bank block, declaration, footer).
-- Run this once on the production backend. It adds the invoice fields to
-- org_settings (if missing) and fills in Radiant Guard Services Private Limited.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS company_gstin text,
  ADD COLUMN IF NOT EXISTS company_state text,
  ADD COLUMN IF NOT EXISTS company_state_code text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS corporate_address text,
  ADD COLUMN IF NOT EXISTS cin text,
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS msme_udyam_no text,
  ADD COLUMN IF NOT EXISTS supplier_type text,
  ADD COLUMN IF NOT EXISTS pf_number text,
  ADD COLUMN IF NOT EXISTS esic_number text,
  ADD COLUMN IF NOT EXISTS default_hsn_sac text,
  ADD COLUMN IF NOT EXISTS invoice_declaration text,
  ADD COLUMN IF NOT EXISTS invoice_note text;

INSERT INTO public.org_settings (company_name)
SELECT 'Radiant Guard Services Private Limited'
WHERE NOT EXISTS (SELECT 1 FROM public.org_settings);

UPDATE public.org_settings SET
  company_name        = 'Radiant Guard Services Private Limited',
  company_gstin       = '27AAECR2832A1ZT',
  company_state       = 'Maharashtra',
  company_state_code  = '27',
  registered_address  = 'Register Office-1-4 Silver Stone Building, Kondhwa, Pune 411048',
  corporate_address   = 'Corporate Office-816, Clover Hills Plaza, NIBM Road, Pune-411048',
  cin                 = 'U74920PN2009PTC133504',
  pan                 = 'AAECR2832A',
  email               = 'info@radiantguards.com',
  bank_name           = 'ICICI BANK',
  bank_account_no     = '007405004982',
  bank_branch         = 'Kondhwa',
  bank_ifsc           = 'ICIC0000074',
  supplier_type       = 'MSME',
  msme_udyam_no       = 'UDYAM-MH-26-0024668',
  pf_number           = 'MH/PUN/301952',
  esic_number         = '33000326200001018',
  default_hsn_sac     = '998525',
  invoice_declaration = 'No Complaints in respect of services supplied vide the invoice will be entertained unless the same is lodged in writing within 07 days from delivery.',
  invoice_note        = 'Delay in the payment beyond the agreed Credit Period will attract an Interest of 24% per annum.',
  updated_at          = now();

NOTIFY pgrst, 'reload schema';
