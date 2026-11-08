-- User-requested removal of one unauthorized invoice extra, not genuine Extra Duty.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.invoice_extra_charges IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.backup_cli2991_mis_increment_20261108 AS
SELECT * FROM public.invoice_extra_charges
WHERE id='6694299d-edcb-4053-9f67-5af869e0fc13'
  AND unit_id='00fde046-854b-4feb-a9b6-888f049ff549'
  AND enabled AND rate=439.01 AND quantity=1
  AND description='Increment / OT as per BFSL MIS Sep-2026';
GRANT ALL ON public.backup_cli2991_mis_increment_20261108 TO service_role;
ALTER TABLE public.backup_cli2991_mis_increment_20261108 ENABLE ROW LEVEL SECURITY;
CREATE TEMP TABLE cli2991_extras_before ON COMMIT DROP AS
SELECT * FROM public.invoice_extra_charges;
CREATE TEMP TABLE cli2991_resources_before ON COMMIT DROP AS
SELECT * FROM public.contract_resources
WHERE contract_id='6eba7040-3cc5-4287-80a9-d407cf9140cd';
CREATE TEMP TABLE cli2991_contract_before ON COMMIT DROP AS
SELECT * FROM public.client_contracts WHERE id='6eba7040-3cc5-4287-80a9-d407cf9140cd';
CREATE TEMP TABLE cli2991_attendance_before ON COMMIT DROP AS
SELECT * FROM public.attendance_entries WHERE unit_id='00fde046-854b-4feb-a9b6-888f049ff549';
DO $$
DECLARE changed integer;
BEGIN
  IF (SELECT count(*) FROM public.backup_cli2991_mis_increment_20261108) <> 1 THEN
    RAISE EXCEPTION 'CLI2991 charge changed since review; abort';
  END IF;
  IF EXISTS (SELECT 1 FROM public.final_invoice_units
    WHERE unit_id='00fde046-854b-4feb-a9b6-888f049ff549'
      AND period_start <= '2026-09-20' AND period_end >= '2026-08-21') THEN
    RAISE EXCEPTION 'Issued CLI2991 invoice requires review before correction';
  END IF;
  UPDATE public.invoice_extra_charges SET enabled=false
  WHERE id='6694299d-edcb-4053-9f67-5af869e0fc13' AND enabled;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Expected one disabled invoice charge'; END IF;
  IF EXISTS (SELECT 1 FROM cli2991_extras_before b
    LEFT JOIN public.invoice_extra_charges e ON e.id=b.id
    WHERE b.id <> '6694299d-edcb-4053-9f67-5af869e0fc13'
    AND to_jsonb(e) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Unrelated invoice charges changed';
  END IF;
  IF EXISTS (SELECT 1 FROM cli2991_resources_before b
    LEFT JOIN public.contract_resources r ON r.id=b.id
    WHERE to_jsonb(r) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Contract rates or staffing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM cli2991_contract_before b
    LEFT JOIN public.client_contracts c ON c.id=b.id
    WHERE to_jsonb(c) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Contract terms changed';
  END IF;
  IF EXISTS (SELECT 1 FROM cli2991_attendance_before b
    LEFT JOIN public.attendance_entries a ON a.id=b.id
    WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Attendance changed';
  END IF;
END $$;
INSERT INTO public.system_logs(module,action,entity_type,entity_label,status,source,actor_name,details)
VALUES('Invoice','disable','invoice_extra_charges','CLI2991 — remove unauthorized MIS increment',
  'success','correction','System (user-requested correction)',
  jsonb_build_object('reason','User requested removal of Increment / OT as per BFSL MIS',
    'charge_id','6694299d-edcb-4053-9f67-5af869e0fc13','removed_amount',439.01,
    'backup','backup_cli2991_mis_increment_20261108'));
\ir ../tests/cli2991-no-mis-increment-assertions.sql
COMMIT;