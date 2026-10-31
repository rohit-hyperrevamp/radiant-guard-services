-- Extra Duty "Custom per-hour rate": ED wage per hour plus ESIC per hour
-- billed on top (invoice ED rate per hour = rate + ESIC).
ALTER TABLE public.contract_resources
  ADD COLUMN IF NOT EXISTS ot_hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS ot_hourly_esic numeric;

ALTER TABLE public.contract_resources DROP CONSTRAINT IF EXISTS contract_resources_ot_basis_chk;
ALTER TABLE public.contract_resources ADD CONSTRAINT contract_resources_ot_basis_chk
  CHECK (ot_basis = ANY (ARRAY['components','gross','earned_gross','formula','hourly']));
ALTER TABLE public.contract_resources DROP CONSTRAINT IF EXISTS contract_resources_ot_hourly_chk;
ALTER TABLE public.contract_resources ADD CONSTRAINT contract_resources_ot_hourly_chk
  CHECK ((ot_hourly_rate IS NULL OR ot_hourly_rate >= 0) AND (ot_hourly_esic IS NULL OR ot_hourly_esic >= 0));
