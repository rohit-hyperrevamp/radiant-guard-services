-- Update CLI403 (ICICI BANK LTD - ICMC PANJIM) Armed Guard rate per the
-- supplied rate sheet (image-110): PF Employer Share 3225, ESIC 0, Bonus NA,
-- Leave 0, Gratuity NA, Total CTC 44264, Billing 47775, Management Fee 3511.
-- Current Armed Guard resource (3986247e-9806-4e68-8689-a3db963d2cfb):
-- gross 41039.58 and ER EPF 3224.52 already match the sheet; changes are:
--   1. Remove "Leave 8.33% (Basic+DA) Employer Cost" (2183.13) -> Leave 0
--   2. Management Fee 900.98 -> 3511
-- New billing = 41039.58 + 3224.52 + 3511 = 47775.10 (~47775 on the sheet).
-- Ex-Service Men Guard resource is untouched (sheet matches Armed Guard only).

CREATE TABLE IF NOT EXISTS public.backup_cli403_rate_20261103 AS
SELECT * FROM public.contract_resources
WHERE contract_id = '467b1458-bf4d-4838-8c0b-017cc162281b';

DO $$
DECLARE
  cur RECORD;
  new_ec jsonb;
BEGIN
  SELECT id, gross, employer_contributions INTO cur
    FROM public.contract_resources
   WHERE id = '3986247e-9806-4e68-8689-a3db963d2cfb'
     AND contract_id = '467b1458-bf4d-4838-8c0b-017cc162281b';

  IF NOT FOUND OR cur.gross <> 41039.58 THEN
    RAISE EXCEPTION 'CLI403 Armed Guard resource not found or unexpected gross: %', cur.gross;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(cur.employer_contributions) e
    WHERE e->>'name' = 'Leave 8.33% (Basic+DA) Employer Cost' AND (e->>'amount')::numeric = 2183.13
  ) THEN
    RAISE EXCEPTION 'Expected Leave 2183.13 entry not found; aborting';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(cur.employer_contributions) e
    WHERE e->>'name' = 'Management Fee' AND (e->>'amount')::numeric = 900.98
  ) THEN
    RAISE EXCEPTION 'Expected Management Fee 900.98 entry not found; aborting';
  END IF;

  SELECT jsonb_agg(
           CASE WHEN e->>'name' = 'Management Fee'
                THEN jsonb_set(e, '{amount}', '3511'::jsonb)
                ELSE e END
         )
    INTO new_ec
    FROM jsonb_array_elements(cur.employer_contributions) e
   WHERE e->>'name' NOT LIKE 'Leave%';

  UPDATE public.contract_resources
     SET employer_contributions = new_ec,
         updated_at = now()
   WHERE id = cur.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.contract_resources r
    WHERE r.id = cur.id
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r.employer_contributions) e WHERE e->>'name' LIKE 'Leave%')
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.employer_contributions) e
                  WHERE e->>'name' = 'Management Fee' AND (e->>'amount')::numeric = 3511)
  ) THEN
    RAISE EXCEPTION 'Post-update verification failed for CLI403 Armed Guard';
  END IF;
END $$;
