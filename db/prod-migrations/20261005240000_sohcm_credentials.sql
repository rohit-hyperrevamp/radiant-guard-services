-- Service-role-only store for the SmartApp (Alfa Laval) sign-in, used by the nightly
-- sync when the live server has no SOHCM_PASSWORD environment variable.
CREATE TABLE IF NOT EXISTS public.sohcm_credentials (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sohcm_credentials FROM anon, authenticated;
GRANT ALL ON public.sohcm_credentials TO service_role;
ALTER TABLE public.sohcm_credentials ENABLE ROW LEVEL SECURITY;
