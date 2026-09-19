-- Client units gain two optional operational fields:
--   zone            : operational zone label (e.g. "West", "North 2")
--   branch_sap_code : client's own SAP code for the branch/site
-- Both are non-mandatory and left blank for existing clients.

alter table public.units
  add column if not exists zone text,
  add column if not exists branch_sap_code text;
