-- Copy CLI2225's updated Security Guard contract rate to 14 named CLIs.
-- Source: CLI2225 active contract 89b177ea-35ba-4a88-974e-23053a6646ff,
-- resource 7f842a9b-d914-4d21-b675-345984137a0f (Security Guard, gross 26781.30:
-- Basic 16562 + DA 8944 + HRA 1275.30; EE EPF 12% cap 33000 + PT MH 200;
-- ER EPF 13% cap 33000 + Management Fee 995 + Leave 8.33% 2125).
-- Only rate-bearing fields are copied; site identity, quantity, designation,
-- day bases and row ids stay untouched. Guarded to rows still on the old
-- 27518.40 rate so anything already diverged is left alone.

CREATE TABLE IF NOT EXISTS public.backup_cli2225_follow_rates_20261103 AS
SELECT r.*
FROM public.contract_resources r
JOIN public.client_contracts cc ON cc.id = r.contract_id
JOIN public.units u ON u.id = cc.unit_id
WHERE cc.status = 'active'
  AND u.code IN ('CLI535','CLI530','CLI540','CLI633','CLI635','CLI580','CLI581',
                 'CLI2015','CLI1239','CLI632','CLI1971','CLI579','CLI2107','CLI531')
  AND r.gross = 27518.40;

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
   WHERE r.id = '7f842a9b-d914-4d21-b675-345984137a0f';

  IF NOT FOUND OR src.gross <> 26781.30 THEN
    RAISE EXCEPTION 'CLI2225 source rate not found or unexpected gross: %', src.gross;
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
     AND u.code IN ('CLI535','CLI530','CLI540','CLI633','CLI635','CLI580','CLI581',
                    'CLI2015','CLI1239','CLI632','CLI1971','CLI579','CLI2107','CLI531')
     AND r.gross = 27518.40
     AND r.designation_id = (SELECT designation_id FROM public.contract_resources
                              WHERE id = '7f842a9b-d914-4d21-b675-345984137a0f');

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 14 THEN
    RAISE EXCEPTION 'Expected 14 resource rows updated, got %', updated_count;
  END IF;
END $$;
