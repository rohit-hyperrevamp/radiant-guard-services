-- CLI4825 uses the existing CLI4008 Haryana Poonawalla Security Guard structure.
-- New-site start is its recorded onboarding date, not CLI4008's start date.
-- Run in a transaction. Snapshot existing attendance before running; assertions
-- below roll back if the contract trigger changes any saved attendance.
DO $$
DECLARE
  source_contract public.client_contracts%ROWTYPE;
  source_resource public.contract_resources%ROWTYPE;
  target_unit public.units%ROWTYPE;
  new_contract public.client_contracts%ROWTYPE;
  new_resource public.contract_resources%ROWTYPE;
  attendance_before jsonb;
  attendance_after jsonb;
  next_code integer;
BEGIN
  LOCK TABLE public.client_contracts IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO STRICT target_unit FROM public.units WHERE code = 'CLI4825';
  SELECT * INTO STRICT source_contract FROM public.client_contracts
    WHERE unit_id = (SELECT id FROM public.units WHERE code = 'CLI4008')
      AND status = 'active' AND approval_status = 'approved';
  SELECT * INTO STRICT source_resource FROM public.contract_resources
    WHERE contract_id = source_contract.id;
  IF target_unit.customer_id <> (SELECT customer_id FROM public.units WHERE code = 'CLI4008')
     OR target_unit.billing_state <> 'Haryana'
     OR source_resource.gross <> 17620
     OR source_resource.ot_hourly_rate <> 161
     OR source_resource.ot_hourly_esic <> 6 THEN
    RAISE EXCEPTION 'Target organization/state or Haryana reference rate changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.client_contracts WHERE unit_id = target_unit.id) THEN
    RAISE EXCEPTION 'CLI4825 already has a contract; review rather than duplicating';
  END IF;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO attendance_before
    FROM public.attendance_entries a WHERE candidate_id IN
      (SELECT candidate_id FROM public.attendance_entries WHERE unit_id = target_unit.id);

  SELECT coalesce(max(substring(contract_code from '^CON([0-9]+)$')::integer), 0) + 1
    INTO next_code FROM public.client_contracts;
  new_contract := source_contract;
  new_contract.id := gen_random_uuid();
  new_contract.contract_code := 'CON' || lpad(next_code::text, 5, '0');
  new_contract.unit_id := target_unit.id;
  new_contract.start_date := target_unit.onboarding_date;
  new_contract.original_start_date := target_unit.onboarding_date;
  new_contract.description := 'CLI4825 Haryana Poonawalla rates copied from CLI4008 on 3 November 2026.';
  new_contract.created_at := now();
  new_contract.updated_at := now();
  new_contract.approved_at := now();
  new_contract.approved_by := null;
  new_contract.created_by := null;
  new_contract.promoted_at := now();
  new_contract.signed_at := null;
  new_contract.signed_pdf_url := '';
  new_contract.company_signature_data := '';
  new_contract.prospect_code := null;
  new_contract.renewal_count := 0;
  INSERT INTO public.client_contracts SELECT (new_contract).*;

  new_resource := source_resource;
  new_resource.id := gen_random_uuid();
  new_resource.contract_id := new_contract.id;
  new_resource.created_at := now();
  new_resource.updated_at := now();
  INSERT INTO public.contract_resources SELECT (new_resource).*;

  IF NOT EXISTS (SELECT 1 FROM public.contract_resources r WHERE r.id = new_resource.id
    AND (to_jsonb(r) - ARRAY['id','contract_id','created_at','updated_at']) =
        (to_jsonb(source_resource) - ARRAY['id','contract_id','created_at','updated_at'])) THEN
    RAISE EXCEPTION 'CLI4825 rate structure does not match CLI4008';
  END IF;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO attendance_after
    FROM public.attendance_entries a WHERE candidate_id IN
      (SELECT candidate_id FROM public.attendance_entries WHERE unit_id = target_unit.id);
  IF attendance_before IS DISTINCT FROM attendance_after THEN
    RAISE EXCEPTION 'Attendance changed during contract creation; rollback required';
  END IF;
  RAISE NOTICE 'Created % for CLI4825, matching CLI4008; attendance preserved', new_contract.contract_code;
END $$;