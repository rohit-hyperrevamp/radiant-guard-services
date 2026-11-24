-- Keep this predicate aligned with src/lib/payroll-reconciliation.ts.
CREATE OR REPLACE FUNCTION public.is_payroll_reconciliation_item(_source text, _name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(_source,'') ~* '(^|_)recon(ciliation)?($|_)'
     OR coalesce(_name,'') ~* '\mpayroll[[:space:]_-]+adjustments?\M';
$$;
REVOKE ALL ON FUNCTION public.is_payroll_reconciliation_item(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_payroll_reconciliation_item(text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.reject_payroll_reconciliation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r jsonb:=to_jsonb(NEW);
BEGIN
 IF TG_TABLE_NAME IN ('additions','deductions') THEN
  IF public.is_payroll_reconciliation_item(r->>'source_kind',coalesce(r->>'addition_name',r->>'deduction_name')) THEN
   RAISE EXCEPTION 'Reconciliation balancing entries are not permitted. Calculate payroll from the contract and attendance.' USING ERRCODE='23514';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(r->'additions','[]'::jsonb)||coalesce(r->'deductions','[]'::jsonb)||coalesce(r->'earnings','[]'::jsonb)) e
   WHERE public.is_payroll_reconciliation_item(e->>'source_kind',e->>'name')) THEN
   RAISE EXCEPTION 'Payroll snapshots cannot contain reconciliation balancing entries.' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_payroll_reconciliation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reject_payroll_reconciliation() TO authenticated,service_role;

CREATE TRIGGER reject_reconciliation_additions BEFORE INSERT OR UPDATE ON public.additions
FOR EACH ROW EXECUTE FUNCTION public.reject_payroll_reconciliation();
CREATE TRIGGER reject_reconciliation_deductions BEFORE INSERT OR UPDATE ON public.deductions
FOR EACH ROW EXECUTE FUNCTION public.reject_payroll_reconciliation();
CREATE TRIGGER reject_reconciliation_snapshots BEFORE INSERT OR UPDATE OF additions,deductions,earnings ON public.payroll_run_snapshots
FOR EACH ROW EXECUTE FUNCTION public.reject_payroll_reconciliation();