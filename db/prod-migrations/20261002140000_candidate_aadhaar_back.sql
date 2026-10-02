ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS aadhaar_back_image_url text;
COMMENT ON COLUMN public.candidates.aadhaar_image_url IS 'Aadhaar card FRONT image';
COMMENT ON COLUMN public.candidates.aadhaar_back_image_url IS 'Aadhaar card BACK image';
