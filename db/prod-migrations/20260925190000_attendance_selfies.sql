-- Geo-tagged face photo on every attendance log in / log out.
ALTER TABLE public.self_attendance_punches
  ADD COLUMN IF NOT EXISTS check_in_photo_path text,
  ADD COLUMN IF NOT EXISTS check_out_photo_path text,
  ADD COLUMN IF NOT EXISTS check_in_place text,
  ADD COLUMN IF NOT EXISTS check_out_place text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-selfies', 'attendance-selfies', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "selfie upload own" ON storage.objects;
CREATE POLICY "selfie upload own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attendance-selfies'
  AND (storage.foldername(name))[1] = (select public.current_user_candidate_id())::text);

DROP POLICY IF EXISTS "selfie read own or radar" ON storage.objects;
CREATE POLICY "selfie read own or radar" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attendance-selfies' AND (
  (storage.foldername(name))[1] = (select public.current_user_candidate_id())::text
  OR (select public.is_admin_user())
  OR (select public.current_user_has_permission('field_sense', 'day_patrol', 'view'))
));
