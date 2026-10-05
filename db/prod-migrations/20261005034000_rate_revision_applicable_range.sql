-- Approve a revised contract-resource rate for an explicit date range.
CREATE OR REPLACE FUNCTION public.approve_contract_rate_revision(
  _id uuid,
  _effective_from date,
  _effective_to date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rev contract_rate_revisions; res contract_resources; prev_from date;
BEGIN
  IF NOT public.current_user_can_edit_contract_rates() THEN
    RAISE EXCEPTION 'Only Super Admin or Leadership can approve rates' USING ERRCODE = '42501';
  END IF;
  IF _effective_from IS NULL OR _effective_to IS NULL THEN
    RAISE EXCEPTION 'Applicable from and applicable till dates are required';
  END IF;
  IF _effective_to < _effective_from THEN
    RAISE EXCEPTION 'Applicable till date cannot be before applicable from date';
  END IF;

  SELECT * INTO rev FROM contract_rate_revisions WHERE id = _id FOR UPDATE;
  IF rev.id IS NULL OR rev.status <> 'new_rate' THEN
    RAISE EXCEPTION 'This revised rate is no longer pending';
  END IF;
  IF EXISTS (
    SELECT 1 FROM contract_rate_revisions
    WHERE resource_id = rev.resource_id
      AND status = 'approved'
      AND effective_from >= _effective_from
  ) THEN
    RAISE EXCEPTION 'Applicable from date must be after the present rate''s start date';
  END IF;

  SELECT * INTO res FROM contract_resources WHERE id = rev.resource_id;
  SELECT effective_from INTO prev_from
  FROM contract_rate_revisions
  WHERE resource_id = rev.resource_id AND status = 'approved'
  ORDER BY effective_from DESC
  LIMIT 1;

  IF prev_from IS NOT NULL THEN
    UPDATE contract_rate_revisions
    SET status = 'expired', effective_to = _effective_from - 1, updated_at = now()
    WHERE resource_id = rev.resource_id
      AND status = 'approved'
      AND effective_from = prev_from;
  ELSE
    INSERT INTO contract_rate_revisions (
      contract_id, resource_id, status, effective_from, effective_to,
      gross, components, benefits, deductions, employer_contributions,
      payroll_day_base_id, billing_day_base_id, shift_hours, promoted_at,
      approved_by, approved_at
    )
    VALUES (
      res.contract_id, res.id, 'expired', NULL, _effective_from - 1,
      res.gross, res.components, res.benefits, res.deductions, res.employer_contributions,
      res.payroll_day_base_id, res.billing_day_base_id, res.shift_hours, now(),
      auth.uid(), now()
    );
  END IF;

  UPDATE contract_rate_revisions
  SET status = 'approved',
      effective_from = _effective_from,
      effective_to = _effective_to,
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  WHERE id = _id;

  PERFORM public.promote_due_contract_rates();
END $$;

REVOKE EXECUTE ON FUNCTION public.approve_contract_rate_revision(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_contract_rate_revision(uuid, date, date) TO authenticated;