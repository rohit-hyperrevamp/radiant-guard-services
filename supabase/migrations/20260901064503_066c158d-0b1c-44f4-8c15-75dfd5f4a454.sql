ALTER TABLE public.org_settings
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

INSERT INTO public.org_settings (company_name, company_gstin, company_state, company_state_code)
SELECT 'Radiant Guard Services Private Limited', '27AAECR2832A1ZT', 'Maharashtra', '27'
WHERE NOT EXISTS (SELECT 1 FROM public.org_settings);

UPDATE public.org_settings SET
  company_name = COALESCE(NULLIF(company_name,''), 'Radiant Guard Services Private Limited'),
  company_gstin = COALESCE(NULLIF(company_gstin,''), '27AAECR2832A1ZT'),
  company_state = COALESCE(NULLIF(company_state,''), 'Maharashtra'),
  company_state_code = COALESCE(NULLIF(company_state_code,''), '27'),
  registered_address = COALESCE(registered_address, 'Register Office - 1-4 Silver Stone Building, Kondhwa, Pune 411048'),
  corporate_address = COALESCE(corporate_address, 'Corporate Office - 816, Clover Hills Plaza, NIBM Road, Pune 411048'),
  cin = COALESCE(cin, 'U74920PN2009PTC133504'),
  pan = COALESCE(pan, 'AAECR2832A'),
  email = COALESCE(email, 'info@radiantguards.com'),
  bank_name = COALESCE(bank_name, 'ICICI BANK'),
  bank_account_no = COALESCE(bank_account_no, '007405004982'),
  bank_branch = COALESCE(bank_branch, 'Kondhwa'),
  bank_ifsc = COALESCE(bank_ifsc, 'ICIC0000074'),
  msme_udyam_no = COALESCE(msme_udyam_no, 'UDYAM-MH-26-0024668'),
  supplier_type = COALESCE(supplier_type, 'MSME'),
  pf_number = COALESCE(pf_number, 'MH/PUN/301952'),
  esic_number = COALESCE(esic_number, '33000326200001018'),
  default_hsn_sac = COALESCE(default_hsn_sac, '998525'),
  invoice_declaration = COALESCE(invoice_declaration, 'No Complaints in respect of services supplied vide the invoice will be entertained unless the same is lodged in writing within 07 days from delivery.'),
  invoice_note = COALESCE(invoice_note, 'Delay in the payment beyond the agreed Credit Period will attract an Interest of 24% per annum.');