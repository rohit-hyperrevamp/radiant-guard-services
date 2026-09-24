-- Units whose MIS is sent on its own: excluded from combined (e.g. state-wide) MIS exports.
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS separate_mis boolean NOT NULL DEFAULT false;

UPDATE public.units SET separate_mis = true
WHERE id IN (
  '9a73534c-ec32-4b93-b17d-7ac15052f7a7', -- CLI4349 Koramangala (CON15944)
  'a9291914-4c9b-403b-b37b-4ee8f8d5218c'  -- CLI4304 Rathi Legacy (CON16019)
);
