-- Optional supporting documents collected by recruiters for recruitment candidates.
CREATE TABLE IF NOT EXISTS public.rec_candidate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.rec_candidates(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    '10th_certificate',
    '12th_certificate',
    'graduation_certificate',
    'salary_slip',
    'resignation_letter',
    'relieving_letter',
    'experience_letter',
    'other'
  )),
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rec_candidate_documents TO authenticated;
GRANT ALL ON public.rec_candidate_documents TO service_role;

ALTER TABLE public.rec_candidate_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rec_candidate_documents_candidate_created_idx
  ON public.rec_candidate_documents(candidate_id, created_at DESC);

DROP POLICY IF EXISTS rec_candidate_documents_recruiter_all ON public.rec_candidate_documents;
CREATE POLICY rec_candidate_documents_recruiter_all
  ON public.rec_candidate_documents
  FOR ALL
  TO authenticated
  USING ((SELECT public.current_user_can_recruit()))
  WITH CHECK ((SELECT public.current_user_can_recruit()));

COMMENT ON TABLE public.rec_candidate_documents IS
  'Optional education, salary, separation, and miscellaneous files collected by Recruitment; metadata only, files remain private in the recruitment bucket.';
