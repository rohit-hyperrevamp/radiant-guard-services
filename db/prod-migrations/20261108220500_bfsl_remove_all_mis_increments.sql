-- Remove remaining unauthorized MIS increments across all BFSL sites and periods.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.invoice_extra_charges IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.backup_bfsl_mis_increment_20261108 AS
SELECT e.* FROM public.invoice_extra_charges e
JOIN public.units u ON u.id=e.unit_id
WHERE u.customer_id='589e6827-8569-4f42-8da5-cc3b870e679e'
  AND e.enabled AND e.description ~* '(increment|[bp]fsl.*mis)';
GRANT ALL ON public.backup_bfsl_mis_increment_20261108 TO service_role;
ALTER TABLE public.backup_bfsl_mis_increment_20261108 ENABLE ROW LEVEL SECURITY;
CREATE TEMP TABLE bfsl_extras_before ON COMMIT DROP AS SELECT * FROM public.invoice_extra_charges;
CREATE TEMP TABLE bfsl_contracts_before ON COMMIT DROP AS
SELECT c.* FROM public.client_contracts c JOIN public.units u ON u.id=c.unit_id
WHERE u.customer_id='589e6827-8569-4f42-8da5-cc3b870e679e';
CREATE TEMP TABLE bfsl_resources_before ON COMMIT DROP AS
SELECT r.* FROM public.contract_resources r JOIN bfsl_contracts_before c ON c.id=r.contract_id;
CREATE TEMP TABLE bfsl_attendance_before ON COMMIT DROP AS
SELECT a.* FROM public.attendance_entries a JOIN public.units u ON u.id=a.unit_id
WHERE u.customer_id='589e6827-8569-4f42-8da5-cc3b870e679e';
DO $$
DECLARE changed integer;
BEGIN
  IF (SELECT count(*) FROM public.backup_bfsl_mis_increment_20261108) <> 6 THEN
    RAISE EXCEPTION 'Remaining BFSL charges changed since review; abort';
  END IF;
  IF EXISTS (SELECT 1 FROM public.final_invoice_units f
    JOIN public.units u ON u.id=f.unit_id
    WHERE u.customer_id='589e6827-8569-4f42-8da5-cc3b870e679e') THEN
    RAISE EXCEPTION 'Issued BFSL invoices require separate review';
  END IF;
  UPDATE public.invoice_extra_charges e SET enabled=false
  FROM public.backup_bfsl_mis_increment_20261108 b WHERE e.id=b.id AND e.enabled;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 6 THEN RAISE EXCEPTION 'Expected exactly six charge removals'; END IF;
  IF EXISTS (SELECT 1 FROM bfsl_extras_before b LEFT JOIN public.invoice_extra_charges e ON e.id=b.id
    WHERE NOT EXISTS (SELECT 1 FROM public.backup_bfsl_mis_increment_20261108 x WHERE x.id=b.id)
    AND to_jsonb(e) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Unrelated invoice extras changed';
  END IF;
  IF EXISTS (SELECT 1 FROM bfsl_contracts_before b LEFT JOIN public.client_contracts c ON c.id=b.id
    WHERE to_jsonb(c) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Contract terms changed'; END IF;
  IF EXISTS (SELECT 1 FROM bfsl_resources_before b LEFT JOIN public.contract_resources r ON r.id=b.id
    WHERE to_jsonb(r) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Rates or staffing changed'; END IF;
  IF EXISTS (SELECT 1 FROM bfsl_attendance_before b LEFT JOIN public.attendance_entries a ON a.id=b.id
    WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Attendance changed'; END IF;
END $$;
INSERT INTO public.system_logs(module,action,entity_type,entity_label,status,source,actor_name,details)
SELECT 'Invoice','disable','invoice_extra_charges',u.code || ' — remove unauthorized BFSL MIS increment',
  'success','correction','System (user-requested correction)',
  jsonb_build_object('reason','User requested removal across all Bajaj Securities invoices',
    'charge_id',b.id,'removed_amount',b.rate*b.quantity,'backup','backup_bfsl_mis_increment_20261108')
FROM public.backup_bfsl_mis_increment_20261108 b JOIN public.units u ON u.id=b.unit_id;
\ir ../tests/bfsl-no-mis-increment-assertions.sql
COMMIT;