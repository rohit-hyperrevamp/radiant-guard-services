-- Copy CLI644's updated Security Guard contract rate to 59 named CLIs.
-- Source: CLI644 active contract 717fb92b-d085-409f-b644-0768c2aa8673,
-- resource 5ed8f695-d527-46db-85bc-6e326ed47573 (Security Guard, gross 20748.00:
-- Basic 12844 + DA 6916 + HRA 5% (Basic+DA) 988; EE EPF 12% cap 23000 + PT MH 200
-- + EE ESI Gross 155.61; ER EPF 13% cap 23000 + ER ESI (Gross) 674
-- + Leave 8.33% (Basic+DA) 1646 + Management Fee 664; round_off_final false).
-- Only rate-bearing fields are copied; site identity, quantity, designation,
-- day bases and row ids stay untouched. Guarded to rows still on the old
-- 21321.30 rate so anything already diverged is left alone.

CREATE TABLE IF NOT EXISTS public.backup_cli644_follow_rates_20261103 AS
SELECT r.*
FROM public.contract_resources r
JOIN public.client_contracts cc ON cc.id = r.contract_id
JOIN public.units u ON u.id = cc.unit_id
WHERE cc.status = 'active'
  AND u.code IN ('CLI659','CLI594','CLI615','CLI698','CLI539','CLI543','CLI623','CLI704',
                 'CLI700','CLI622','CLI626','CLI592','CLI593','CLI624','CLI586','CLI638',
                 'CLI692','CLI613','CLI681','CLI616','CLI614','CLI647','CLI642','CLI597',
                 'CLI609','CLI767','CLI627','CLI688','CLI687','CLI683','CLI691','CLI648',
                 'CLI650','CLI656','CLI702','CLI658','CLI667','CLI645','CLI663','CLI666',
                 'CLI669','CLI637','CLI655','CLI694','CLI701','CLI608','CLI680','CLI690',
                 'CLI603','CLI689','CLI685','CLI612','CLI610','CLI602','CLI651','CLI2110',
                 'CLI2105','CLI2960','CLI3196')
  AND r.gross = 21321.30;

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
   WHERE r.id = '5ed8f695-d527-46db-85bc-6e326ed47573';

  IF NOT FOUND OR src.gross <> 20748.00 THEN
    RAISE EXCEPTION 'CLI644 source rate not found or unexpected gross: %', src.gross;
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
     AND u.code IN ('CLI659','CLI594','CLI615','CLI698','CLI539','CLI543','CLI623','CLI704',
                    'CLI700','CLI622','CLI626','CLI592','CLI593','CLI624','CLI586','CLI638',
                    'CLI692','CLI613','CLI681','CLI616','CLI614','CLI647','CLI642','CLI597',
                    'CLI609','CLI767','CLI627','CLI688','CLI687','CLI683','CLI691','CLI648',
                    'CLI650','CLI656','CLI702','CLI658','CLI667','CLI645','CLI663','CLI666',
                    'CLI669','CLI637','CLI655','CLI694','CLI701','CLI608','CLI680','CLI690',
                    'CLI603','CLI689','CLI685','CLI612','CLI610','CLI602','CLI651','CLI2110',
                    'CLI2105','CLI2960','CLI3196')
     AND r.gross = 21321.30
     AND r.designation_id = (SELECT designation_id FROM public.contract_resources
                              WHERE id = '5ed8f695-d527-46db-85bc-6e326ed47573');

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 59 THEN
    RAISE EXCEPTION 'Expected 59 resource rows updated, got %', updated_count;
  END IF;
END $$;
