-- Service-role-only store for the AlertCheckin sign-in, used by the nightly
-- sync when the live server has no ALERTCHECKIN_* environment variables.
CREATE TABLE IF NOT EXISTS public.alertcheckin_credentials (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email text NOT NULL,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.alertcheckin_credentials FROM anon, authenticated;
GRANT ALL ON public.alertcheckin_credentials TO service_role;
ALTER TABLE public.alertcheckin_credentials ENABLE ROW LEVEL SECURITY;
