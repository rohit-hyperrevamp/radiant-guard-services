-- Training module: files live in private storage bucket "training"; DB holds metadata only.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('training', 'training', false, 104857600)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_modules_role_idx ON public.training_modules (role_key, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_modules TO authenticated;
GRANT ALL ON public.training_modules TO service_role;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_modules_admin_all ON public.training_modules;
CREATE POLICY training_modules_admin_all ON public.training_modules FOR ALL TO authenticated
  USING ((select public.is_admin_user())) WITH CHECK ((select public.is_admin_user()));
DROP POLICY IF EXISTS training_modules_role_read ON public.training_modules;
CREATE POLICY training_modules_role_read ON public.training_modules FOR SELECT TO authenticated
  USING (is_active AND role_key = (select public.current_user_role_key()));

DROP TRIGGER IF EXISTS training_modules_updated_at ON public.training_modules;
CREATE TRIGGER training_modules_updated_at BEFORE UPDATE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS training_files_admin_all ON storage.objects;
CREATE POLICY training_files_admin_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'training' AND (select public.is_admin_user()))
  WITH CHECK (bucket_id = 'training' AND (select public.is_admin_user()));
DROP POLICY IF EXISTS training_files_role_read ON storage.objects;
CREATE POLICY training_files_role_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training' AND EXISTS (
    SELECT 1 FROM public.training_modules m
    WHERE m.file_path = storage.objects.name AND m.is_active
      AND m.role_key = (select public.current_user_role_key())));
