-- Billing-only request: all L&T Gujarat contracts, including historical ones.
BEGIN;
CREATE TEMP TABLE lt_gujarat_before ON COMMIT DROP AS
SELECT r.id, to_jsonb(r) AS row_data,
  u.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353'::uuid
    AND lower(trim(u.client_state)) = 'gujarat' AS targeted
FROM public.contract_resources r
JOIN public.client_contracts c ON c.id = r.contract_id
JOIN public.units u ON u.id = c.unit_id;

DO $$
BEGIN
  IF (SELECT count(*) FROM lt_gujarat_before WHERE targeted) <> 85 THEN
    RAISE EXCEPTION 'L&T Gujarat scope changed; review before applying';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.billing_day_bases
    WHERE id = 'da912811-7b87-4517-aba9-42636592b921'
      AND code = 'DAYS_MINUS_4' AND method = 'actual_minus_days' AND fixed_days = 4) THEN
    RAISE EXCEPTION 'Days Minus Four billing option is missing';
  END IF;
END $$;

UPDATE public.contract_resources r
SET billing_day_base_id = 'da912811-7b87-4517-aba9-42636592b921'
FROM lt_gujarat_before b
WHERE b.id = r.id AND b.targeted
  AND r.billing_day_base_id IS DISTINCT FROM 'da912811-7b87-4517-aba9-42636592b921'::uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.contract_resources r JOIN lt_gujarat_before b ON b.id = r.id
    WHERE b.targeted AND r.billing_day_base_id IS DISTINCT FROM 'da912811-7b87-4517-aba9-42636592b921'::uuid) THEN
    RAISE EXCEPTION 'Target billing setting was not saved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contract_resources r JOIN lt_gujarat_before b ON b.id = r.id
    WHERE b.targeted AND (to_jsonb(r) - 'billing_day_base_id' - 'updated_at')
      IS DISTINCT FROM (b.row_data - 'billing_day_base_id' - 'updated_at')) THEN
    RAISE EXCEPTION 'Payroll or another rate field changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contract_resources r JOIN lt_gujarat_before b ON b.id = r.id
    WHERE NOT coalesce(b.targeted, false) AND to_jsonb(r) IS DISTINCT FROM b.row_data) THEN
    RAISE EXCEPTION 'A client outside L&T Gujarat changed';
  END IF;
END $$;
COMMIT;