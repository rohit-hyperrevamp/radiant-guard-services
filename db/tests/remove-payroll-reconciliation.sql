-- Production regression: run only as a rollback transaction. No fixture survives.
BEGIN ISOLATION LEVEL REPEATABLE READ;
CREATE TEMP TABLE untouched_payroll_items AS
SELECT 'addition' kind,id,md5(to_jsonb(a)::text) checksum FROM public.additions a
 WHERE NOT public.is_payroll_reconciliation_item(source_kind,addition_name)
UNION ALL
SELECT 'deduction',id,md5(to_jsonb(d)::text) FROM public.deductions d
 WHERE NOT public.is_payroll_reconciliation_item(source_kind,deduction_name);
CREATE TEMP TABLE before_site_inputs AS
SELECT 'attendance' kind,id::text id,md5(to_jsonb(a)::text) checksum FROM public.attendance_entries a
 WHERE unit_id=(SELECT id FROM public.units WHERE code='CLI4530')
UNION ALL SELECT 'contract',r.id::text,md5(to_jsonb(r)::text) FROM public.contract_resources r
 JOIN public.client_contracts c ON c.id=r.contract_id WHERE c.unit_id=(SELECT id FROM public.units WHERE code='CLI4530');
CREATE TEMP TABLE before_run_state AS SELECT id,md5(to_jsonb(p)::text) checksum FROM public.payroll_runs p;

DO $$
DECLARE a public.additions; d public.deductions; s public.payroll_run_snapshots;
BEGIN
 IF NOT public.is_payroll_reconciliation_item('pages_sep_2026_recon','Renamed item')
 OR NOT public.is_payroll_reconciliation_item('payroll_run','47363 - Payroll Adjustment - Sep 2026')
 OR public.is_payroll_reconciliation_item('payroll_amendment','EPF refund') THEN
  RAISE EXCEPTION 'Balancing classification incorrectly includes genuine items'; END IF;
 SELECT * INTO a FROM public.additions LIMIT 1;
 BEGIN
  UPDATE public.additions SET addition_name='Payroll Adjustment',source_kind='manual' WHERE id=a.id;
  RAISE EXCEPTION 'Reconciliation addition was accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 SELECT * INTO d FROM public.deductions LIMIT 1;
 BEGIN
  UPDATE public.deductions SET source_kind='pages_sep_2026_recon',deduction_name='Renamed recovery' WHERE id=d.id;
  RAISE EXCEPTION 'Reconciliation deduction was accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 SELECT * INTO s FROM public.payroll_run_snapshots LIMIT 1;
 BEGIN
  UPDATE public.payroll_run_snapshots SET additions='[{"name":"Payroll Adjustment","amount":1089}]' WHERE id=s.id;
  RAISE EXCEPTION 'Posted reconciliation copy was accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

\ir ../data-fixes/20261124_remove_payroll_reconciliation.sql

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM untouched_payroll_items b LEFT JOIN public.additions a ON a.id=b.id WHERE b.kind='addition' AND b.checksum IS DISTINCT FROM md5(to_jsonb(a)::text))
 OR EXISTS(SELECT 1 FROM untouched_payroll_items b LEFT JOIN public.deductions d ON d.id=b.id WHERE b.kind='deduction' AND b.checksum IS DISTINCT FROM md5(to_jsonb(d)::text)) THEN
  RAISE EXCEPTION 'Genuine employee items were altered'; END IF;
 IF EXISTS(SELECT 1 FROM before_site_inputs b LEFT JOIN public.attendance_entries a ON a.id::text=b.id WHERE b.kind='attendance' AND b.checksum IS DISTINCT FROM md5(to_jsonb(a)::text))
 OR EXISTS(SELECT 1 FROM before_site_inputs b LEFT JOIN public.contract_resources r ON r.id::text=b.id WHERE b.kind='contract' AND b.checksum IS DISTINCT FROM md5(to_jsonb(r)::text)) THEN
  RAISE EXCEPTION 'Attendance or contract rates changed'; END IF;
 IF EXISTS(SELECT 1 FROM before_run_state b LEFT JOIN public.payroll_runs p ON p.id=b.id WHERE b.checksum IS DISTINCT FROM md5(to_jsonb(p)::text)) THEN
  RAISE EXCEPTION 'Payroll status, approval or payment metadata changed'; END IF;
 IF EXISTS(SELECT 1 FROM reconciliation_snapshots_before b JOIN public.payroll_run_snapshots s ON s.id=b.id
  WHERE s.net_pay<>greatest(0,s.gross-s.total_deductions)
  OR s.employer_contributions IS DISTINCT FROM b.employer_contributions
  OR s.total_employer IS DISTINCT FROM b.total_employer
  OR s.paid_days IS DISTINCT FROM b.paid_days OR s.ed_days IS DISTINCT FROM b.ed_days
  OR s.posted_at IS DISTINCT FROM b.posted_at OR s.posted_by IS DISTINCT FROM b.posted_by) THEN
  RAISE EXCEPTION 'Snapshot totals, employer costs, days or posting metadata incorrectly changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.additions WHERE source_kind='pages_sep_2026' OR source_kind='pages_addition')
 OR NOT EXISTS(SELECT 1 FROM public.deductions WHERE source_kind='pages_sep_2026') THEN
  RAISE EXCEPTION 'Real imported payroll items were removed'; END IF;
END $$;
ROLLBACK;