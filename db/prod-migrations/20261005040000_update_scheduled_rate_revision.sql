-- Edit an approved revised rate that has not started yet (wages and/or dates).
CREATE OR REPLACE FUNCTION public.update_scheduled_contract_rate_revision(
  _id uuid,
  _effective_from date,
  _effective_to date,
  _payload jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rev contract_rate_revisions; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.current_user_can_edit_contract_rates() THEN
    RAISE EXCEPTION 'Only Super Admin or Leadership can edit rates' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO rev FROM contract_rate_revisions WHERE id = _id FOR UPDATE;
  IF rev.id IS NULL OR rev.status <> 'approved' OR rev.promoted_at IS NOT NULL OR rev.effective_from <= today THEN
    RAISE EXCEPTION 'Only upcoming revised rates can be edited';
  END IF;
  IF _effective_from IS NULL OR _effective_to IS NULL OR _effective_to < _effective_from THEN
    RAISE EXCEPTION 'Choose a valid applicable from / till range';
  END IF;
  IF _effective_from <= today THEN
    RAISE EXCEPTION 'Applicable from must be a future date';
  END IF;

  -- Move the end of the rate immediately before this one.
  UPDATE contract_rate_revisions
  SET effective_to = _effective_from - 1, updated_at = now()
  WHERE resource_id = rev.resource_id
    AND id <> rev.id
    AND status IN ('approved','expired')
    AND effective_to = rev.effective_from - 1;

  UPDATE contract_rate_revisions SET
    effective_from = _effective_from,
    effective_to = _effective_to,
    gross = COALESCE((_payload->>'gross')::numeric, gross),
    components = COALESCE(_payload->'components', components),
    benefits = COALESCE(_payload->'benefits', benefits),
    deductions = COALESCE(_payload->'deductions', deductions),
    employer_contributions = COALESCE(_payload->'employer_contributions', employer_contributions),
    payroll_day_base_id = CASE WHEN _payload ? 'payroll_day_base_id' THEN NULLIF(_payload->>'payroll_day_base_id','')::uuid ELSE payroll_day_base_id END,
    billing_day_base_id = CASE WHEN _payload ? 'billing_day_base_id' THEN NULLIF(_payload->>'billing_day_base_id','')::uuid ELSE billing_day_base_id END,
    shift_hours = COALESCE((_payload->>'shift_hours')::int, shift_hours),
    updated_at = now()
  WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.update_scheduled_contract_rate_revision(uuid, date, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_scheduled_contract_rate_revision(uuid, date, date, jsonb) TO authenticated;
