BEGIN;
CREATE TABLE IF NOT EXISTS public.employee_document_policies (
 purpose text PRIMARY KEY CHECK (purpose IN ('onboarding','rehire','offboarding')),
 required_keys text[] NOT NULL DEFAULT '{}',
 deadline_days integer NOT NULL DEFAULT 10 CHECK (deadline_days BETWEEN 0 AND 365),
 owner_candidate_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.employee_document_policies TO authenticated;
GRANT ALL ON public.employee_document_policies TO service_role;
ALTER TABLE public.employee_document_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_policies_read ON public.employee_document_policies FOR SELECT TO authenticated USING ((select public.current_user_module_access('employees','view')) OR (select public.current_user_module_access('recruitment','view')));
CREATE POLICY document_policies_write ON public.employee_document_policies FOR ALL TO authenticated USING ((select public.current_user_module_access('recruitment','edit'))) WITH CHECK ((select public.current_user_module_access('recruitment','edit')));
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.employee_document_policies FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Recruitment Documents');

CREATE TABLE IF NOT EXISTS public.employee_document_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid,
 rec_candidate_id uuid REFERENCES public.rec_candidates(id) ON DELETE CASCADE,
 document_key text NOT NULL,
 file_path text NOT NULL UNIQUE,
 file_name text NOT NULL,
 uploaded_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((candidate_id IS NULL) <> (rec_candidate_id IS NULL))
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.employee_document_receipts TO authenticated;
GRANT ALL ON public.employee_document_receipts TO service_role;
ALTER TABLE public.employee_document_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_receipts_read ON public.employee_document_receipts FOR SELECT TO authenticated USING (
 (candidate_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id=candidate_id) AND (select public.current_user_module_access('employees','view')))
 OR (rec_candidate_id IS NOT NULL AND (select public.current_user_module_access('recruitment','view')))
);
CREATE POLICY document_receipts_write ON public.employee_document_receipts FOR INSERT TO authenticated WITH CHECK (
 (select public.current_user_module_access('recruitment','edit')) AND uploaded_by=(select auth.uid())
 AND ((candidate_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.candidates c WHERE c.id=candidate_id)) OR (rec_candidate_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.rec_candidates c WHERE c.id=rec_candidate_id)))
);
CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.employee_document_receipts FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Recruitment Documents');

INSERT INTO public.employee_document_policies(purpose,required_keys,deadline_days,owner_candidate_id) VALUES
 ('onboarding',ARRAY['photo','aadhaar_front','aadhaar_back','pan','signature'],10,'8e173d6d-7a2d-4961-b924-84e836f8b7e4'),
 ('rehire',ARRAY['resignation','id_card'],10,'8e173d6d-7a2d-4961-b924-84e836f8b7e4'),
 ('offboarding',ARRAY['resignation','id_card'],10,'8e173d6d-7a2d-4961-b924-84e836f8b7e4') ON CONFLICT (purpose) DO NOTHING;
COMMIT;