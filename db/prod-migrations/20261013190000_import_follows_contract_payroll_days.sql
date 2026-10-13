-- Imported attendance must follow the contract's Payroll Days like any other
-- attendance: Present beyond the limit becomes Extra Duty. Removes the import
-- bypass and re-shapes recent unprocessed attendance for every contract line.
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_contract_present_day_limit'::regproc) INTO d;
  d := replace(d, E'IF coalesce(current_setting(''app.attendance_source'', true), '''') = ''import'' THEN\n    RETURN NEW;\n  END IF;', '');
  EXECUTE d;
END $$;

DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (cr.contract_id, cr.designation_id) cr.contract_id, cr.designation_id, cr.payroll_day_base_id
    FROM public.contract_resources cr
    JOIN public.client_contracts cc ON cc.id = cr.contract_id AND cc.record_type = 'client' AND cc.status = 'active'
    WHERE cr.designation_id IS NOT NULL
    ORDER BY cr.contract_id, cr.designation_id, cr.sort_order, cr.created_at
  LOOP
    n := n + public.rebalance_attendance_present_cap(r.contract_id, r.designation_id, r.payroll_day_base_id);
  END LOOP;
  RAISE NOTICE 'rows changed: %', n;
END $$;
