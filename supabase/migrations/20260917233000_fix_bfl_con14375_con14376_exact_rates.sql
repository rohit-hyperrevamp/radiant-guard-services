-- Align the two BFL Pune rate cards to the April 2026 source workbook.
-- Preserve source precision so the editor and final billing rate reconcile.
UPDATE public.contract_resources cr
SET
  components = (
    SELECT jsonb_agg(
      CASE
        WHEN lower(item->>'name') = 'hra' THEN jsonb_set(item, '{amount}', to_jsonb(2574.90::numeric), true)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(cr.components) WITH ORDINALITY AS x(item, ord)
  ),
  employer_contributions = (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'costComponentId' = 'baf10000-0001-4001-8001-000000000002' THEN jsonb_set(item, '{amount}', to_jsonb(557.895::numeric), true)
        WHEN item->>'costComponentId' = 'baf10000-0001-4001-8001-000000000003' THEN jsonb_set(item, '{amount}', to_jsonb(1201.62::numeric), true)
        WHEN item->>'costComponentId' = 'cc900000-0001-4001-8001-000000000004' THEN jsonb_set(item, '{amount}', to_jsonb(686.64::numeric), true)
        WHEN item->>'costComponentId' = 'baf10000-0001-4001-8001-000000000004' THEN jsonb_set(item, '{amount}', to_jsonb(4490.4070685::numeric), true)
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(cr.employer_contributions) WITH ORDINALITY AS x(item, ord)
  ),
  gross = 22540.90,
  updated_at = now()
FROM public.client_contracts cc
WHERE cr.contract_id = cc.id
  AND cc.contract_code IN ('CON14375', 'CON14376');
