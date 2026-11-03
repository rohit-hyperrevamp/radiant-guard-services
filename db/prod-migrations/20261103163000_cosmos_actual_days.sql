-- All Cosmos Bank active contracts: payroll AND billing day basis = Actual Days in Month.
CREATE TABLE IF NOT EXISTS public.backup_cosmos_daybase_20261103 AS
SELECT r.* FROM public.contract_resources r
JOIN public.client_contracts cc ON cc.id = r.contract_id AND cc.status = 'active'
JOIN public.units u ON u.id = cc.unit_id
JOIN public.customers cu ON cu.id = u.customer_id AND cu.name ILIKE '%cosmos%';

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.contract_resources r
     SET payroll_day_base_id = 'e23708c1-250e-4440-b76d-1c2c63a99218',
         billing_day_base_id = 'c82178db-3864-471f-b078-1510ea49a2f9',
         updated_at = now()
    FROM public.client_contracts cc, public.units u, public.customers cu
   WHERE cc.id = r.contract_id AND cc.status = 'active'
     AND u.id = cc.unit_id AND cu.id = u.customer_id AND cu.name ILIKE '%cosmos%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 24 THEN RAISE EXCEPTION 'Expected 24 rows, updated %', n; END IF;
END $$;
