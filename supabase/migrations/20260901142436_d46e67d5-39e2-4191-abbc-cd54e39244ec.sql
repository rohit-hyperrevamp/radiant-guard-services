CREATE TABLE IF NOT EXISTS public.digilocker_sessions (
  client_id text PRIMARY KEY,
  profile jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.digilocker_sessions TO service_role;
ALTER TABLE public.digilocker_sessions ENABLE ROW LEVEL SECURITY;