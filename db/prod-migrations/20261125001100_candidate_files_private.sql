-- 20261125001100_candidate_files_private.sql
-- RISK: HIGH (data-dependent) - run the PRE-CHECK; apply only when it returns 0
--       (or after running the signed-URL backfill).
--
-- CLOSES: S4. Bucket candidate-files (Aadhaar, PAN, bank proofs, photos, exit docs)
--   was created public=true and its object policies let ANY signed-in user list,
--   read, overwrite or delete every file ("Authenticated read candidate-files",
--   "Candidate files auth insert/update/delete" - bucket_id check only).
--
-- WHAT IT DOES
--   * storage.buckets: candidate-files -> public = false (public object URLs stop working).
--   * Drops every storage.objects policy whose USING/WITH CHECK mentions
--     'candidate-files' (snapshotted first) and creates:
--       rf_candidate_files_read    SELECT : staff('view')  OR owner = auth.uid()
--       rf_candidate_files_insert  INSERT : staff('edit')  OR (active employee AND path starts
--                                           'photo/' or 'thumb/')   -- own profile photo, avatar thumbs
--       rf_candidate_files_update  UPDATE : staff('edit')  OR owner = auth.uid()
--       rf_candidate_files_delete  DELETE : admin OR Employees edit OR owner = auth.uid()
--     staff(action) = public.candidate_files_staff_access(action):
--       admin OR Employees <action> OR Recruitment <action> (current_user_module_access)
--       OR onboarding submit/approve (current_user_can_submit_onboarding / _approve_onboarding)
--       OR inventory manager (offboarding docs from Uniform Collections)
--       OR (view only) Payroll view.
--     NOTE on "owner's own folder": upload paths are by document type, not by person
--     (photo/<aadhaar>-ts, thumb/<candidate>-ts, rehire/<kind>/..., offboarding/<guard>/...,
--     <slot>/<aadhaar>-ts), so per-person folders do not exist; storage.objects.owner
--     (the uploader) is used as "own" instead.
--
-- APP / DATA IMPACT
--   * The app already uploads and then stores createSignedUrl() links (10-year expiry):
--       src/components/candidate-extra-sections.tsx:589-594, src/components/EmployeeAvatar.tsx:47-51,
--       src/lib/workflows.ts:308-312, src/routes/admin.profile.tsx:769-773,
--       src/routes/admin.inventory.collections.tsx:584-588, src/routes/admin.employees.tsx:7124-7130,
--       src/components/CandidateEsicCard.tsx (BUCKET constant).
--     No file in src/ builds a getPublicUrl() for candidate-files (getPublicUrl is used only
--     for org-logos: IdCardEditor.tsx:103, admin.customers.customer-manager.tsx:728).
--     Existing signed links keep working (signed URLs bypass RLS).
--   * ANY STORED PUBLIC URL (".../storage/v1/object/public/candidate-files/...") WILL BREAK.
--     src/lib/backfill-signed-urls.functions.ts converts them to signed URLs - run it first.
--   * Residual risk (README): 10-year signed URLs stored in candidates rows remain
--     bearer links readable by anyone who can read those rows; follow-up = store paths
--     and sign short-lived on demand.
--
-- AFFECTED SCREENS / ROLES: employee form uploads, profile photo, avatar thumbnails,
--   rehire documents, offboarding collections, ESIC card, document follow-up/exports.
--
-- PRE-CHECK (must be 0 before applying):
--   SELECT count(*) FROM public.candidates c
--   WHERE to_jsonb(c)::text LIKE '%/object/public/candidate-files/%';
--   SELECT public FROM storage.buckets WHERE id = 'candidate-files';
-- VERIFY AFTER APPLYING:
--   SELECT public FROM storage.buckets WHERE id='candidate-files';               -- false
--   SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
--    AND (qual LIKE '%candidate-files%' OR with_check LIKE '%candidate-files%');   -- only rf_candidate_files_*
--   As a guard: storage.from('candidate-files').list('aadhaar') -> []; upload own profile photo -> ok.
--   As HR: open an employee, documents and photo render; upload a new PAN image -> ok.

BEGIN;

INSERT INTO review_fix_202611.acl_snapshot(migration, object_type, object_name, extra)
SELECT '20261125001100', 'bucket', b.id, jsonb_build_object('public', b.public)
FROM storage.buckets b WHERE b.id = 'candidate-files'
ON CONFLICT (migration, object_type, object_name) DO NOTHING;

SELECT review_fix_202611.snapshot_policies('20261125001100', 'storage', 'objects');

CREATE OR REPLACE FUNCTION public.candidate_files_staff_access(_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR public.current_user_module_access('employees', _action)
      OR public.current_user_module_access('recruitment', _action)
      OR COALESCE(public.current_user_can_submit_onboarding(), false)
      OR COALESCE(public.current_user_can_approve_onboarding(), false)
      OR COALESCE(public.current_user_is_inventory_manager(), false)
      OR (_action = 'view' AND public.current_user_module_access('payroll', 'view'));
$$;
REVOKE ALL ON FUNCTION public.candidate_files_staff_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_files_staff_access(text) TO authenticated, service_role;

UPDATE storage.buckets SET public = false WHERE id = 'candidate-files' AND public IS DISTINCT FROM false;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'storage' AND tablename = 'objects'
             AND (COALESCE(qual, '') LIKE '%candidate-files%' OR COALESCE(with_check, '') LIKE '%candidate-files%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY rf_candidate_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'candidate-files'
         AND ((SELECT public.candidate_files_staff_access('view')) OR owner = (SELECT auth.uid())));

CREATE POLICY rf_candidate_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'candidate-files'
              AND ((SELECT public.candidate_files_staff_access('edit'))
                   OR ((name LIKE 'photo/%' OR name LIKE 'thumb/%')
                       AND (SELECT public.is_current_employee_active()))));

CREATE POLICY rf_candidate_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'candidate-files'
         AND ((SELECT public.candidate_files_staff_access('edit')) OR owner = (SELECT auth.uid())))
  WITH CHECK (bucket_id = 'candidate-files'
         AND ((SELECT public.candidate_files_staff_access('edit')) OR owner = (SELECT auth.uid())));

CREATE POLICY rf_candidate_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'candidate-files'
         AND ((SELECT public.is_admin_user())
              OR (SELECT public.current_user_module_access('employees', 'edit'))
              OR owner = (SELECT auth.uid())));

COMMIT;

-- ======================================================================
-- ROLLBACK (run manually) - restores the bucket flag and exactly the
-- candidate-files policies that existed at apply time (other buckets untouched).
-- Static reference (repo): "Authenticated read candidate-files" SELECT TO authenticated
--   USING (bucket_id = 'candidate-files') [20260615051032]; "Candidate files auth insert|update|delete"
--   TO authenticated WITH CHECK/USING (bucket_id = 'candidate-files') [20260516031734].
-- WARNING: re-opens S4.
-- ======================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS rf_candidate_files_read ON storage.objects;
-- DROP POLICY IF EXISTS rf_candidate_files_insert ON storage.objects;
-- DROP POLICY IF EXISTS rf_candidate_files_update ON storage.objects;
-- DROP POLICY IF EXISTS rf_candidate_files_delete ON storage.objects;
-- DO $$
-- DECLARE r record; _roles text;
-- BEGIN
--   FOR r IN SELECT * FROM review_fix_202611.policy_snapshot
--            WHERE migration = '20261125001100' AND schemaname = 'storage' AND tablename = 'objects'
--              AND (COALESCE(qual,'') LIKE '%candidate-files%' OR COALESCE(with_check,'') LIKE '%candidate-files%') LOOP
--     SELECT string_agg(CASE WHEN x = 'public' THEN 'public' ELSE quote_ident(x) END, ', ') INTO _roles FROM unnest(r.roles) x;
--     EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
--     EXECUTE format('CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s', r.policyname, r.permissive, r.cmd, _roles,
--       CASE WHEN r.qual IS NOT NULL THEN ' USING (' || r.qual || ')' ELSE '' END,
--       CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END);
--   END LOOP;
--   UPDATE storage.buckets b SET public = (s.extra->>'public')::boolean
--   FROM review_fix_202611.acl_snapshot s
--   WHERE s.migration = '20261125001100' AND s.object_type = 'bucket' AND s.object_name = b.id;
-- END $$;
-- DROP FUNCTION IF EXISTS public.candidate_files_staff_access(text);
-- COMMIT;
