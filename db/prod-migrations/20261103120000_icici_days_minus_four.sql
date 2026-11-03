-- Set billing AND payroll day basis to "Days Minus Four" (DAYS_MINUS_4,
-- 1bffe4e2-dce4-4f34-be14-9038afcd6e58) on every resource of every ACTIVE
-- contract belonging to ICICI Bank customers.
-- State before: all 111 active-contract resources already had payroll = Days
-- Minus Four; billing day basis was NULL on all 111. This sets both columns
-- explicitly to Days Minus Four. Only the two day-basis columns change;
-- rates, quantities, designations and row ids stay untouched.

CREATE TABLE IF NOT EXISTS public.backup_icici_daybase_20261103 AS
SELECT r.*
FROM public.contract_resources r
JOIN public.client_contracts cc ON cc.id = r.contract_id AND cc.status = 'active'
JOIN public.units u ON u.id = cc.unit_id
JOIN public.customers cu ON cu.id = u.customer_id AND cu.name ILIKE '%icici%';

DO $$
DECLARE
  backup_count integer;
  updated_count integer;
  verify_count integer;
BEGIN
  SELECT count(*) INTO backup_count FROM public.backup_icici_daybase_20261103;
  IF backup_count <> 111 THEN
    RAISE EXCEPTION 'Expected 111 ICICI active-contract resources in backup, found %', backup_count;
  END IF;

  UPDATE public.contract_resources r
     SET payroll_day_base_id = '1bffe4e2-dce4-4f34-be14-9038afcd6e58',
         billing_day_base_id = 'da912811-7b87-4517-aba9-42636592b921',
         updated_at = now()
    FROM public.client_contracts cc, public.units u, public.customers cu
   WHERE cc.id = r.contract_id
     AND cc.status = 'active'
     AND u.id = cc.unit_id
     AND cu.id = u.customer_id
     AND cu.name ILIKE '%icici%';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 111 THEN
    RAISE EXCEPTION 'Expected to update 111 rows, updated %', updated_count;
  END IF;

  SELECT count(*) INTO verify_count
    FROM public.contract_resources r
    JOIN public.client_contracts cc ON cc.id = r.contract_id AND cc.status = 'active'
    JOIN public.units u ON u.id = cc.unit_id
    JOIN public.customers cu ON cu.id = u.customer_id AND cu.name ILIKE '%icici%'
   WHERE r.payroll_day_base_id = '1bffe4e2-dce4-4f34-be14-9038afcd6e58'
     AND r.billing_day_base_id = 'da912811-7b87-4517-aba9-42636592b921';

  IF verify_count <> 111 THEN
    RAISE EXCEPTION 'Verification failed: % of 111 rows on Days Minus Four', verify_count;
  END IF;
END $$;
