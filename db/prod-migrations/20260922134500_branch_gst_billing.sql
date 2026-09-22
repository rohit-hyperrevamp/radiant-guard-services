-- Supplier GST registrations used to choose the legal invoice origin by client state.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS corporate_address text,
  ADD COLUMN IF NOT EXISTS gst_state_name text,
  ADD COLUMN IF NOT EXISTS gst_state_code text,
  ADD COLUMN IF NOT EXISTS is_gst_billing_branch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gst_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.branches
  DROP CONSTRAINT IF EXISTS branches_gstin_format_check;
ALTER TABLE public.branches
  ADD CONSTRAINT branches_gstin_format_check
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');

CREATE UNIQUE INDEX IF NOT EXISTS branches_unique_active_gst_state
  ON public.branches (lower(gst_state_name))
  WHERE is_gst_billing_branch AND gst_state_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branches_one_default_gst_registration
  ON public.branches (is_gst_default)
  WHERE is_gst_default;

UPDATE public.branches SET
  gstin = '27AAECR2832A1ZT',
  registered_address = 'Office No. 1-4, Silver Stone Building, Near Shital Petrol Pump, Kondhwa Khurd, Pune, Maharashtra 411048',
  corporate_address = 'Office No. 816, Clover Hills Plaza, NIBM Road, Pune, Maharashtra 411048',
  gst_state_name = 'Maharashtra', gst_state_code = '27',
  is_gst_billing_branch = true, is_gst_default = true
WHERE code = 'BR1';

UPDATE public.branches SET
  gstin = '36AAECR2832A1ZU',
  registered_address = 'Marwadi Lane, House No. 15-41-8/1, Balaji Nagar, Near TVS Show Room, Jawahar Nagar, Kapra Mandal, Medchal-Malkajgiri, Hyderabad, Telangana 500087',
  corporate_address = NULL,
  gst_state_name = 'Telangana', gst_state_code = '36',
  is_gst_billing_branch = true, is_gst_default = false
WHERE code = 'BR27';

UPDATE public.branches SET
  gstin = '29AAECR2832A1ZP',
  registered_address = 'Ground Floor, 8th Block, 613, II Cross, Opposite Koramangala Police Station, Koramangala, Bengaluru, Karnataka 560095',
  corporate_address = NULL,
  gst_state_name = 'Karnataka', gst_state_code = '29',
  is_gst_billing_branch = true, is_gst_default = false
WHERE code = 'BR20';

UPDATE public.branches SET
  gstin = '30AAECR2832A1Z6',
  registered_address = 'A R Arcade, Flat No. F-1, Nova Gulli, Varca, South Goa, Goa 403721',
  corporate_address = NULL,
  gst_state_name = 'Goa', gst_state_code = '30',
  is_gst_billing_branch = true, is_gst_default = false
WHERE code = 'BR10';

UPDATE public.branches SET
  gstin = '24AAECR2832A1ZZ',
  registered_address = '97/308, Gujarat Housing Board, Meghaninagar, Ahmedabad, Gujarat 380016',
  corporate_address = NULL,
  gst_state_name = 'Gujarat', gst_state_code = '24',
  is_gst_billing_branch = true, is_gst_default = false
WHERE code = 'BR11';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
