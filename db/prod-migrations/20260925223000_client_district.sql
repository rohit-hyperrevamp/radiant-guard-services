ALTER TABLE public.units ADD COLUMN IF NOT EXISTS client_district text;
UPDATE public.units SET client_district = coalesce(nullif(client_district,''), billing_district);
