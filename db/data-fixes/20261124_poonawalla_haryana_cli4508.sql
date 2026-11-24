-- Run inside a transaction after backing up and verifying CLI4508.
-- Copy saved rate settings only; retain identities, quantities, contract terms and history.
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

CREATE TEMP TABLE haryana_reference ON COMMIT DROP AS
SELECT r.* FROM public.contract_resources r
JOIN public.client_contracts c ON c.id = r.contract_id
JOIN public.units u ON u.id = c.unit_id
WHERE u.code = 'CLI4508' AND u.status = 'active' AND c.status = 'active'
FOR SHARE OF r, c, u;

CREATE TEMP TABLE haryana_target_ids ON COMMIT DROP AS
SELECT r.id, u.code, u.id AS unit_id, c.id AS contract_id
FROM public.contract_resources r
JOIN public.client_contracts c ON c.id = r.contract_id
JOIN public.units u ON u.id = c.unit_id
JOIN public.customers customer ON customer.id = u.customer_id
WHERE u.code <> 'CLI4508' AND u.status = 'active' AND c.status = 'active'
  AND u.name ILIKE '%poonawalla%' AND customer.name ILIKE '%poonawalla%'
  AND lower(trim(coalesce(nullif(u.client_state, ''), nullif(u.shipping_state, ''), nullif(u.billing_state, ''), ''))) = 'haryana'
FOR UPDATE OF r;

CREATE TEMP TABLE haryana_original_rates ON COMMIT DROP AS
SELECT r.* FROM public.contract_resources r JOIN haryana_target_ids t ON t.id = r.id;

DO $$
BEGIN
  IF (SELECT count(*) FROM haryana_reference) <> 1
    OR NOT EXISTS (SELECT 1 FROM haryana_reference WHERE designation_id = 'aad77ba7-98d2-44cb-a0f1-b598eed740f4' AND shift_hours = 8)
  THEN RAISE EXCEPTION 'CLI4508 reference role changed; review before copying'; END IF;
  IF (SELECT count(*) FROM haryana_target_ids) <> 87
    OR (SELECT count(DISTINCT contract_id) FROM haryana_target_ids) <> 87
  THEN RAISE EXCEPTION 'Haryana target roster changed; review the backup before copying'; END IF;
  IF EXISTS (
    SELECT 1 FROM haryana_original_rates t CROSS JOIN haryana_reference s
    WHERE t.designation_id IS DISTINCT FROM s.designation_id
      OR t.shift_hours IS DISTINCT FROM s.shift_hours
      OR t.payroll_day_base_id IS DISTINCT FROM s.payroll_day_base_id
  ) THEN RAISE EXCEPTION 'Role, shift or payroll day base differs; do not guess'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.contract_rate_revisions v
    JOIN haryana_target_ids t ON t.id = v.resource_id
  ) THEN RAISE EXCEPTION 'Historical rate revisions need separate date-aware review'; END IF;
END $$;

-- Payroll day base is already identical and is not written: avoid attendance-rule triggers.
UPDATE public.contract_resources t SET
  components = s.components,
  gross = s.gross,
  benefits = s.benefits,
  deductions = s.deductions,
  employer_contributions = s.employer_contributions,
  shift_hours = s.shift_hours,
  billing_day_base_id = s.billing_day_base_id,
  round_off_final = s.round_off_final,
  round_off_totals = s.round_off_totals,
  ot_multiplier = s.ot_multiplier,
  ot_basis = s.ot_basis,
  ot_formula = s.ot_formula,
  ot_esi = s.ot_esi,
  ot_hourly_rate = s.ot_hourly_rate,
  ot_hourly_esic = s.ot_hourly_esic,
  invoice_present_cap = s.invoice_present_cap
FROM haryana_reference s, haryana_target_ids selected
WHERE t.id = selected.id
  AND (to_jsonb(t) - ARRAY['id','contract_id','designation_id','service_type_id','quantity','sort_order','created_at','updated_at','role_key'])
    IS DISTINCT FROM
      (to_jsonb(s) - ARRAY['id','contract_id','designation_id','service_type_id','quantity','sort_order','created_at','updated_at','role_key']);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contract_resources t
    JOIN haryana_target_ids selected ON selected.id = t.id CROSS JOIN haryana_reference s
    WHERE (to_jsonb(t) - ARRAY['id','contract_id','designation_id','service_type_id','quantity','sort_order','created_at','updated_at','role_key'])
      IS DISTINCT FROM (to_jsonb(s) - ARRAY['id','contract_id','designation_id','service_type_id','quantity','sort_order','created_at','updated_at','role_key'])
  ) THEN RAISE EXCEPTION 'A Haryana rate does not match CLI4508'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.contract_resources t JOIN haryana_original_rates old USING (id)
    WHERE jsonb_build_array(t.id,t.contract_id,t.designation_id,t.service_type_id,t.quantity,t.sort_order,t.created_at,t.role_key)
      IS DISTINCT FROM jsonb_build_array(old.id,old.contract_id,old.designation_id,old.service_type_id,old.quantity,old.sort_order,old.created_at,old.role_key)
  ) THEN RAISE EXCEPTION 'Client-specific identity or staffing changed'; END IF;
END $$;