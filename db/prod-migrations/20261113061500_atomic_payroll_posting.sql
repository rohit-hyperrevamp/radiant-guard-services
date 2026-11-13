-- Production-only deployment. One RPC is one PostgreSQL transaction.
-- Existing Access Control/workflow helpers and RLS remain authoritative.
CREATE OR REPLACE FUNCTION public.save_payroll_posting_atomic(_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  run public.payroll_runs%ROWTYPE;
  sheet public.attendance_sheets%ROWTYPE;
  rid uuid := (_payload->>'runId')::uuid;
  uid uuid := (_payload->>'unitId')::uuid;
  ver integer := (_payload->>'version')::integer;
  mode text := _payload->>'mode';
  ref text;
  kind text;
  item jsonb;
  key text;
  cols text;
  n integer;
  latest integer;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.current_user_can_process_payroll(),false) THEN
    RAISE EXCEPTION 'Payroll processing is not permitted' USING ERRCODE='42501';
  END IF;
  IF mode IS NULL OR mode NOT IN ('regular','amendment') OR ver IS NULL OR ver < 1 THEN
    RAISE EXCEPTION 'Invalid payroll posting mode or version';
  END IF;
  -- Lock the run before reading or changing any ledger; concurrent clicks serialize.
  SELECT * INTO run FROM public.payroll_runs WHERE id=rid FOR UPDATE;
  IF NOT FOUND OR run.unit_id IS DISTINCT FROM uid
    OR run.period_start IS DISTINCT FROM (_payload->>'periodStart')::date
    OR run.period_end IS DISTINCT FROM (_payload->>'periodEnd')::date THEN
    RAISE EXCEPTION 'Payroll run or period does not match';
  END IF;
  SELECT * INTO sheet FROM public.attendance_sheets
    WHERE unit_id=uid AND period_start=run.period_start AND period_end=run.period_end FOR UPDATE;
  IF NOT FOUND OR coalesce(sheet.current_version,1)<>ver THEN
    RAISE EXCEPTION 'Attendance changed; reopen and review payroll';
  END IF;
  SELECT coalesce(max(version),0) INTO latest FROM public.payroll_run_snapshots WHERE payroll_run_id=rid;
  -- Never silently replace settled money on a retry or replay.
  IF latest>=ver THEN RAISE EXCEPTION 'This payroll version is already saved; reopen payroll to see its result'; END IF;
  IF mode='regular' THEN
    IF run.status<>'approved' OR run.payroll_status='processed' OR sheet.status<>'approved' THEN
      RAISE EXCEPTION 'Approved, unprocessed payroll and approved attendance are required';
    END IF;
    kind:='payroll_run'; ref:='payroll_run:'||rid;
  ELSE
    IF run.payroll_status<>'processed' OR latest=0 OR sheet.amendment_status<>'approved' THEN
      RAISE EXCEPTION 'A paid payroll and approved attendance amendment are required';
    END IF;
    kind:='payroll_amendment'; ref:='payroll_run:'||rid||':v'||ver;
  END IF;
  FOREACH key IN ARRAY ARRAY['deductions','additions','contributions','holds','snapshots'] LOOP
    IF jsonb_typeof(_payload->key) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing payroll %',key; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(_payload->key) LOOP
      IF item->>'candidate_id' IS NULL OR NOT EXISTS(SELECT 1 FROM public.candidates WHERE id=(item->>'candidate_id')::uuid) THEN
        RAISE EXCEPTION 'Payroll employee not found';
      END IF;
      IF key IN ('deductions','additions','contributions') AND
        (item->>'source_kind' IS DISTINCT FROM kind OR item->>'source_ref' IS DISTINCT FROM ref) THEN
        RAISE EXCEPTION 'Payroll line reference does not match';
      END IF;
      IF key IN ('deductions','contributions','holds','snapshots') AND (item->>'unit_id')::uuid IS DISTINCT FROM uid THEN
        RAISE EXCEPTION 'Payroll line site does not match';
      END IF;
      IF key IN ('contributions','holds','snapshots') AND (item->>'payroll_run_id')::uuid IS DISTINCT FROM rid THEN
        RAISE EXCEPTION 'Payroll line run does not match';
      END IF;
      IF key='snapshots' AND (item->>'version')::integer IS DISTINCT FROM ver THEN RAISE EXCEPTION 'Snapshot version does not match'; END IF;
      IF key IN ('deductions','additions','contributions') AND
        (item->>'amount' IS NULL OR item->>'amount' IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid payroll amount'; END IF;
    END LOOP;
  END LOOP;
  IF jsonb_array_length(_payload->'snapshots')=0 THEN RAISE EXCEPTION 'Payroll snapshot cannot be empty'; END IF;
  DELETE FROM public.deductions WHERE source_kind=kind AND source_ref=ref;
  DELETE FROM public.additions WHERE source_kind=kind AND source_ref=ref;
  DELETE FROM public.employer_contributions WHERE payroll_run_id=rid AND source_kind=kind AND source_ref=ref;
  IF mode='regular' THEN DELETE FROM public.payroll_processing_holds WHERE payroll_run_id=rid; END IF;
  -- Only explicitly allowlisted columns are inserted; IDs and audit timestamps use defaults.
  cols:='unit_id,candidate_id,deduction_type_id,deduction_name,deduction_date,amount,calculation_type,entry_mode,installments,description,status,source_kind,source_ref';
  EXECUTE format('INSERT INTO public.deductions (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.deductions,$1)',cols,cols) USING _payload->'deductions';
  cols:='candidate_id,addition_type_id,addition_name,addition_date,amount,calculation_type,entry_mode,installments,description,status,source_kind,source_ref';
  EXECUTE format('INSERT INTO public.additions (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.additions,$1)',cols,cols) USING _payload->'additions';
  cols:='candidate_id,unit_id,payroll_run_id,contribution_name,amount,frequency,period_start,period_end,contribution_date,status,notes,source_kind,source_ref';
  EXECUTE format('INSERT INTO public.employer_contributions (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.employer_contributions,$1)',cols,cols) USING _payload->'contributions';
  IF mode='regular' THEN
    INSERT INTO public.payroll_processing_holds(payroll_run_id,candidate_id,unit_id,reason,status,created_by)
    SELECT payroll_run_id,candidate_id,unit_id,reason,status,auth.uid()
    FROM jsonb_populate_recordset(NULL::public.payroll_processing_holds,_payload->'holds');
  END IF;
  INSERT INTO public.payroll_run_snapshots(payroll_run_id,unit_id,candidate_id,version,employee_code,full_name,paid_days,ed_days,gross,total_deductions,total_employer,net_pay,earnings,deductions,employer_contributions,additions,on_hold,posted_by)
  SELECT payroll_run_id,unit_id,candidate_id,version,employee_code,full_name,paid_days,ed_days,gross,total_deductions,total_employer,net_pay,earnings,deductions,employer_contributions,additions,on_hold,auth.uid()
  FROM jsonb_populate_recordset(NULL::public.payroll_run_snapshots,_payload->'snapshots');
  UPDATE public.payroll_runs SET payroll_status='processed',payroll_processed_at=now(),payroll_processed_by=auth.uid() WHERE id=rid;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Payroll completion was not saved'; END IF;
  IF mode='amendment' THEN
    UPDATE public.attendance_sheets SET amendment_status='processed' WHERE id=sheet.id;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'Amendment completion was not saved'; END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_payroll_posting_atomic(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payroll_posting_atomic(jsonb) TO authenticated;
COMMENT ON FUNCTION public.save_payroll_posting_atomic(jsonb) IS 'Atomic payroll ledgers, holds, snapshots and completion; invoker RLS and configurable payroll processing permission.';
