-- Rate card revisions per contract resource line.
-- status: new_rate (draft copy, never used), approved (applies from effective_from),
-- expired (snapshot of the previous rate, applies until effective_to), discarded.
CREATE TABLE IF NOT EXISTS public.contract_rate_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.client_contracts(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.contract_resources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new_rate' CHECK (status IN ('new_rate','approved','expired','discarded')),
  effective_from date,
  effective_to date,
  gross numeric NOT NULL DEFAULT 0,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
  employer_contributions jsonb NOT NULL DEFAULT '[]'::jsonb,
  payroll_day_base_id uuid,
  billing_day_base_id uuid,
  shift_hours integer NOT NULL DEFAULT 8,
  promoted_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crr_resource ON public.contract_rate_revisions(resource_id, status);
CREATE INDEX IF NOT EXISTS idx_crr_contract ON public.contract_rate_revisions(contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS crr_one_draft_per_resource
  ON public.contract_rate_revisions(resource_id) WHERE status = 'new_rate';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_rate_revisions TO authenticated;
GRANT ALL ON public.contract_rate_revisions TO service_role;
ALTER TABLE public.contract_rate_revisions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_contract_rates()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_user()
      OR COALESCE(public.current_user_role_key(), '') IN ('super_admin','admin','leadership');
$$;

DROP POLICY IF EXISTS "crr read" ON public.contract_rate_revisions;
CREATE POLICY "crr read" ON public.contract_rate_revisions FOR SELECT TO authenticated
  USING (resource_id IN (SELECT id FROM public.contract_resources));
DROP POLICY IF EXISTS "crr insert drafts" ON public.contract_rate_revisions;
CREATE POLICY "crr insert drafts" ON public.contract_rate_revisions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_can_edit_contract_rates()) AND status = 'new_rate');
DROP POLICY IF EXISTS "crr update drafts" ON public.contract_rate_revisions;
CREATE POLICY "crr update drafts" ON public.contract_rate_revisions FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_can_edit_contract_rates()) AND status = 'new_rate')
  WITH CHECK ((SELECT public.current_user_can_edit_contract_rates()) AND status IN ('new_rate','discarded'));

-- Copy future-dated approved rates onto the live resource line once their date arrives.
CREATE OR REPLACE FUNCTION public.promote_due_contract_rates()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM contract_rate_revisions
    WHERE status = 'approved' AND promoted_at IS NULL
      AND effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    ORDER BY effective_from
  LOOP
    UPDATE contract_resources SET
      gross = r.gross, components = r.components, benefits = r.benefits,
      deductions = r.deductions, employer_contributions = r.employer_contributions,
      payroll_day_base_id = r.payroll_day_base_id, billing_day_base_id = r.billing_day_base_id,
      shift_hours = r.shift_hours, updated_at = now()
    WHERE id = r.resource_id;
    UPDATE contract_rate_revisions SET promoted_at = now(), updated_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.approve_contract_rate_revision(_id uuid, _effective_from date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rev contract_rate_revisions; res contract_resources; prev_from date;
BEGIN
  IF NOT public.current_user_can_edit_contract_rates() THEN
    RAISE EXCEPTION 'Only Super Admin or Leadership can approve rates' USING ERRCODE = '42501';
  END IF;
  IF _effective_from IS NULL THEN RAISE EXCEPTION 'Applicable date is required'; END IF;
  SELECT * INTO rev FROM contract_rate_revisions WHERE id = _id FOR UPDATE;
  IF rev.id IS NULL OR rev.status <> 'new_rate' THEN RAISE EXCEPTION 'This new rate is no longer pending'; END IF;
  IF EXISTS (SELECT 1 FROM contract_rate_revisions WHERE resource_id = rev.resource_id
             AND status = 'approved' AND effective_from >= _effective_from) THEN
    RAISE EXCEPTION 'Applicable date must be after the current rate''s start date';
  END IF;
  SELECT * INTO res FROM contract_resources WHERE id = rev.resource_id;

  -- Rate in force just before the new date (scheduled-but-unpromoted rate if any, else the live line).
  SELECT effective_from INTO prev_from FROM contract_rate_revisions
   WHERE resource_id = rev.resource_id AND status = 'approved'
   ORDER BY effective_from DESC LIMIT 1;

  IF prev_from IS NOT NULL THEN
    UPDATE contract_rate_revisions SET status = 'expired', effective_to = _effective_from - 1, updated_at = now()
     WHERE resource_id = rev.resource_id AND status = 'approved' AND effective_from = prev_from;
  ELSE
    INSERT INTO contract_rate_revisions (contract_id, resource_id, status, effective_from, effective_to,
      gross, components, benefits, deductions, employer_contributions, payroll_day_base_id,
      billing_day_base_id, shift_hours, promoted_at, approved_by, approved_at)
    VALUES (res.contract_id, res.id, 'expired', NULL, _effective_from - 1,
      res.gross, res.components, res.benefits, res.deductions, res.employer_contributions,
      res.payroll_day_base_id, res.billing_day_base_id, res.shift_hours, now(), auth.uid(), now());
  END IF;

  UPDATE contract_rate_revisions SET status = 'approved', effective_from = _effective_from,
    approved_by = auth.uid(), approved_at = now(), updated_at = now() WHERE id = _id;
  PERFORM public.promote_due_contract_rates();
END $$;
GRANT EXECUTE ON FUNCTION public.approve_contract_rate_revision(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_contract_rates() TO authenticated;

SELECT cron.unschedule('promote-contract-rates') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'promote-contract-rates');
SELECT cron.schedule('promote-contract-rates', '1 18 * * *', $$select public.promote_due_contract_rates();$$);
