-- Copy CLI596's updated Security Guard contract rate to 15 named CLIs.
-- Source: CLI596 active contract cf006cf7-4950-4f21-baf3-a78b304047b8,
-- resource 81ab2b48-62c4-4430-b8c5-afddf979b56d (Security Guard, gross 24378.90:
-- Basic 15054 + DA 8164 + HRA 5% (Basic+DA) 1160.90; EE EPF 12% cap 33000 + PT MH 200;
-- ER EPF 13% cap 33000 + Management Fee 825 + Bonus/Exgratia 8.33% (Basic+DA) 1934).
-- Only rate-bearing fields are copied; site identity, quantity, designation,
-- day bases and row ids stay untouched. Guarded to rows still on the old
-- 25061.40 rate so anything already diverged is left alone.

CREATE TABLE IF NOT EXISTS public.backup_cli596_follow_rates_20261103 AS
SELECT r.*
FROM public.contract_resources r
JOIN public.client_contracts cc ON cc.id = r.contract_id
JOIN public.units u ON u.id = cc.unit_id
WHERE cc.status = 'active'
  AND u.code IN ('CLI582','CLI703','CLI584','CLI588','CLI587','CLI590','CLI595','CLI589',
                 'CLI611','CLI684','CLI697','CLI591','CLI686','CLI2016','CLI2380')
  AND r.gross = 25061.40;

DO $$
DECLARE
  src RECORD;
  updated_count integer;
BEGIN
  SELECT r.components, r.benefits, r.deductions, r.employer_contributions,
         r.gross, r.shift_hours, r.round_off_final, r.round_off_totals,
         r.ot_multiplier, r.ot_basis, r.ot_formula, r.ot_esi,
         r.ot_hourly_rate, r.ot_hourly_esic
    INTO src
    FROM public.contract_resources r
   WHERE r.id = '81ab2b48-62c4-4430-b8c5-afddf979b56d';

  IF NOT FOUND OR src.gross <> 24378.90 THEN
    RAISE EXCEPTION 'CLI596 source rate not found or unexpected gross: %', src.gross;
  END IF;

  UPDATE public.contract_resources r
     SET components = src.components,
         benefits = src.benefits,
         deductions = src.deductions,
         employer_contributions = src.employer_contributions,
         gross = src.gross,
         shift_hours = src.shift_hours,
         round_off_final = src.round_off_final,
         round_off_totals = src.round_off_totals,
         ot_multiplier = src.ot_multiplier,
         ot_basis = src.ot_basis,
         ot_formula = src.ot_formula,
         ot_esi = src.ot_esi,
         ot_hourly_rate = src.ot_hourly_rate,
         ot_hourly_esic = src.ot_hourly_esic,
         updated_at = now()
    FROM public.client_contracts cc, public.units u
   WHERE cc.id = r.contract_id
     AND u.id = cc.unit_id
     AND cc.status = 'active'
     AND u.code IN ('CLI582','CLI703','CLI584','CLI588','CLI587','CLI590','CLI595','CLI589',
                    'CLI611','CLI684','CLI697','CLI591','CLI686','CLI2016','CLI2380')
     AND r.gross = 25061.40
     AND r.designation_id = (SELECT designation_id FROM public.contract_resources
                              WHERE id = '81ab2b48-62c4-4430-b8c5-afddf979b56d');

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 15 THEN
    RAISE EXCEPTION 'Expected 15 resource rows updated, got %', updated_count;
  END IF;
END $$;
