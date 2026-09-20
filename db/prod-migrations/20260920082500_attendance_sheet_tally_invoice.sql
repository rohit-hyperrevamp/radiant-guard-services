-- Store the actual Tally invoice against the approved attendance period that
-- drives each client invoice. Files live in a private bucket; only the path
-- and original filename are retained on the period record.
ALTER TABLE public.attendance_sheets
  ADD COLUMN IF NOT EXISTS tally_invoice_path text,
  ADD COLUMN IF NOT EXISTS tally_invoice_name text,
  ADD COLUMN IF NOT EXISTS tally_invoice_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS tally_invoice_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tally-invoices',
  'tally-invoices',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Invoice users read Tally invoices" ON storage.objects;
CREATE POLICY "Invoice users read Tally invoices"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tally-invoices'
  AND public.current_user_has_permission('invoice', '', 'view')
);

DROP POLICY IF EXISTS "Invoice editors upload Tally invoices" ON storage.objects;
CREATE POLICY "Invoice editors upload Tally invoices"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tally-invoices'
  AND public.current_user_has_permission('invoice', '', 'edit')
);

DROP POLICY IF EXISTS "Invoice editors replace Tally invoices" ON storage.objects;
CREATE POLICY "Invoice editors replace Tally invoices"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tally-invoices'
  AND public.current_user_has_permission('invoice', '', 'edit')
)
WITH CHECK (
  bucket_id = 'tally-invoices'
  AND public.current_user_has_permission('invoice', '', 'edit')
);

DROP POLICY IF EXISTS "Invoice editors delete Tally invoices" ON storage.objects;
CREATE POLICY "Invoice editors delete Tally invoices"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tally-invoices'
  AND public.current_user_has_permission('invoice', '', 'edit')
);