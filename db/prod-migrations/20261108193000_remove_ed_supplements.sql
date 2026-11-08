-- Remove unauthorized third Extra Duty charges, not the contract-priced ED line.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.invoice_extra_charges IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.backup_ed_supplements_20261108 AS
SELECT * FROM public.invoice_extra_charges
WHERE enabled AND description ILIKE '%extra duty supplement%';
GRANT ALL ON public.backup_ed_supplements_20261108 TO service_role;
ALTER TABLE public.backup_ed_supplements_20261108 ENABLE ROW LEVEL SECURITY;

CREATE TEMP TABLE extras_before ON COMMIT DROP AS
SELECT * FROM public.invoice_extra_charges;
CREATE TEMP TABLE resources_before ON COMMIT DROP AS
SELECT r.* FROM public.contract_resources r
WHERE r.contract_id IN (SELECT contract_id FROM public.backup_ed_supplements_20261108);
CREATE TEMP TABLE contracts_before ON COMMIT DROP AS
SELECT c.* FROM public.client_contracts c
WHERE c.id IN (SELECT contract_id FROM public.backup_ed_supplements_20261108);
CREATE TEMP TABLE attendance_before ON COMMIT DROP AS
SELECT a.* FROM public.attendance_entries a
WHERE a.unit_id IN (SELECT unit_id FROM public.backup_ed_supplements_20261108);

DO $$
DECLARE changed integer;
BEGIN
  IF (SELECT count(*) FROM public.backup_ed_supplements_20261108) <> 15 THEN
    RAISE EXCEPTION 'Expected exactly 15 unauthorized supplements; review changed data';
  END IF;
  UPDATE public.invoice_extra_charges e SET enabled=false
  FROM public.backup_ed_supplements_20261108 b WHERE e.id=b.id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>15 THEN RAISE EXCEPTION 'Expected 15 disabled charges'; END IF;
  IF EXISTS (SELECT 1 FROM extras_before b LEFT JOIN public.invoice_extra_charges e ON e.id=b.id
    WHERE b.id NOT IN (SELECT id FROM public.backup_ed_supplements_20261108)
    AND to_jsonb(e) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Unrelated invoice charges changed';
  END IF;
  IF EXISTS (SELECT 1 FROM resources_before b LEFT JOIN public.contract_resources r ON r.id=b.id
    WHERE to_jsonb(r) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Contract rates or staffing changed';
  END IF;
  IF EXISTS (SELECT 1 FROM contracts_before b LEFT JOIN public.client_contracts c ON c.id=b.id
    WHERE to_jsonb(c) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Contract terms changed';
  END IF;
  IF EXISTS (SELECT 1 FROM attendance_before b LEFT JOIN public.attendance_entries a ON a.id=b.id
    WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Attendance changed';
  END IF;
END $$;
INSERT INTO public.system_logs(module,action,entity_type,entity_label,status,source,actor_name,details)
VALUES('Invoice','disable','invoice_extra_charges','Remove unauthorized Extra Duty supplements (15)',
 'success','correction','System (user-requested correction)',
 jsonb_build_object('reason','User requested P Days and Extra Days only; remove third supplement',
 'backup','backup_ed_supplements_20261108','count',15,'cli2535_removed_amount',398.53));
\ir ../tests/no-extra-duty-supplements-assertions.sql
COMMIT;