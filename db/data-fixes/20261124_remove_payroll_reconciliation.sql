-- One transaction, invoked inside BEGIN/COMMIT (or BEGIN/ROLLBACK for verification).
-- Delete only balancing entries. Their originals remain in the existing deletion audit.
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='120s';

SELECT p.id FROM public.payroll_runs p WHERE EXISTS (
 SELECT 1 FROM public.payroll_run_snapshots s,
 LATERAL jsonb_array_elements(coalesce(s.additions,'[]')||coalesce(s.deductions,'[]')||coalesce(s.earnings,'[]')) e
 WHERE s.payroll_run_id=p.id AND public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')) FOR UPDATE;
SELECT s.id FROM public.payroll_run_snapshots s WHERE EXISTS (
 SELECT 1 FROM jsonb_array_elements(coalesce(s.additions,'[]')||coalesce(s.deductions,'[]')||coalesce(s.earnings,'[]')) e
 WHERE public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')) FOR UPDATE;

CREATE TEMP TABLE reconciliation_snapshots_before ON COMMIT DROP AS
SELECT s.* FROM public.payroll_run_snapshots s WHERE EXISTS (
 SELECT 1 FROM jsonb_array_elements(coalesce(s.additions,'[]')||coalesce(s.deductions,'[]')||coalesce(s.earnings,'[]')) e
 WHERE public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name'));

WITH clean AS (
 SELECT b.id,
 coalesce((SELECT jsonb_agg(e ORDER BY ord) FROM jsonb_array_elements(coalesce(b.additions,'[]')) WITH ORDINALITY x(e,ord)
  WHERE NOT public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')),'[]'::jsonb) additions,
 coalesce((SELECT jsonb_agg(e ORDER BY ord) FROM jsonb_array_elements(coalesce(b.deductions,'[]')) WITH ORDINALITY x(e,ord)
  WHERE NOT public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')),'[]'::jsonb) deductions,
 coalesce((SELECT jsonb_agg(e ORDER BY ord) FROM jsonb_array_elements(coalesce(b.earnings,'[]')) WITH ORDINALITY x(e,ord)
  WHERE NOT public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')),'[]'::jsonb) earnings,
 round(b.gross-coalesce((SELECT sum((e->>'amount')::numeric) FROM jsonb_array_elements(coalesce(b.additions,'[]')||coalesce(b.earnings,'[]')) e
  WHERE public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')),0),2) gross,
 round(b.total_deductions-coalesce((SELECT sum((e->>'amount')::numeric) FROM jsonb_array_elements(coalesce(b.deductions,'[]')) e
  WHERE public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')),0),2) total_deductions
 FROM reconciliation_snapshots_before b
)
UPDATE public.payroll_run_snapshots s SET additions=c.additions,deductions=c.deductions,earnings=c.earnings,
 gross=c.gross,total_deductions=c.total_deductions,net_pay=greatest(0,round(c.gross-c.total_deductions,2))
FROM clean c WHERE s.id=c.id;

INSERT INTO public.system_logs(module,action,entity_type,entity_id,entity_label,status,source,details)
SELECT 'Payroll','update','payroll_run_snapshots',b.id::text,b.employee_code||' — reconciliation removal','success','database',
 jsonb_build_object('reason','Remove earlier synthetic reconciliation adjustments at user request',
  'requested_by','Rohit Joshi','before',to_jsonb(b),'after',to_jsonb(s))
FROM reconciliation_snapshots_before b JOIN public.payroll_run_snapshots s ON s.id=b.id;

-- Avoid the normal deletion invalidator's per-item/per-period attendance fan-out.
-- Only cache invalidation is replaced; audit and all permission/write guards stay enabled.
-- These trigger changes and deletions are transactional, restored even on rollback.
ALTER TABLE public.additions DISABLE TRIGGER zz_finance_delete;
ALTER TABLE public.deductions DISABLE TRIGGER zz_finance_delete;
CREATE TEMP TABLE reconciliation_removed_items(kind text,id uuid) ON COMMIT DROP;
WITH removed AS (DELETE FROM public.additions WHERE public.is_payroll_reconciliation_item(source_kind,addition_name) RETURNING id)
INSERT INTO reconciliation_removed_items SELECT 'addition',id FROM removed;
WITH removed AS (DELETE FROM public.deductions WHERE public.is_payroll_reconciliation_item(source_kind,deduction_name) RETURNING id)
INSERT INTO reconciliation_removed_items SELECT 'deduction',id FROM removed;
ALTER TABLE public.additions ENABLE TRIGGER zz_finance_delete;
ALTER TABLE public.deductions ENABLE TRIGGER zz_finance_delete;
-- Snapshot/gross changes can alter another site's monthly PT base. Conservatively
-- invalidate the saved company-wide summaries once; never reuse adjusted totals.
UPDATE public.finance_period_totals SET generation=generation+1,retry_after=NULL
WHERE EXISTS(SELECT 1 FROM reconciliation_removed_items) OR EXISTS(SELECT 1 FROM reconciliation_snapshots_before);

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.additions WHERE public.is_payroll_reconciliation_item(source_kind,addition_name))
 OR EXISTS(SELECT 1 FROM public.deductions WHERE public.is_payroll_reconciliation_item(source_kind,deduction_name))
 OR EXISTS(SELECT 1 FROM public.payroll_run_snapshots s, LATERAL jsonb_array_elements(coalesce(s.additions,'[]')||coalesce(s.deductions,'[]')||coalesce(s.earnings,'[]')) e
  WHERE public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')) THEN
  RAISE EXCEPTION 'Reconciliation adjustment removal was incomplete';
 END IF;
END $$;