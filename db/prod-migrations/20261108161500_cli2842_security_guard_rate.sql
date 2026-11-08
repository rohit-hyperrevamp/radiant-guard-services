-- CLI2842 active contract, Security Guard only, per supplied image-127 sheet (Total D 20,624.41).
-- EPF -> 13% of 15000 ceiling (1950), fee -> 7% of Total CTC; removes LWF and billing adjustment lines not on sheet.
BEGIN;
CREATE TABLE IF NOT EXISTS public.backup_cli2842_sg_20261108 AS
  SELECT * FROM contract_resources WHERE id = 'b83424f5-fdf5-4291-86c4-3e1596efc649';
GRANT ALL ON public.backup_cli2842_sg_20261108 TO service_role;
ALTER TABLE public.backup_cli2842_sg_20261108 ENABLE ROW LEVEL SECURITY;
UPDATE contract_resources r SET employer_contributions = (
  SELECT jsonb_agg(CASE
    WHEN e->>'name' LIKE 'ER EPF%' THEN e || jsonb_build_object('name','ER EPF 13% (Flat 15000)','amount',1950,
      'percentage',13,'calcType','percentage','formulaMode','advanced','formulaExpression','15000 * 0.13',
      'costComponentId','cc142930-0001-4001-8001-000000000002','contractOverride',true)
    WHEN e->>'name' = 'Management Fees' THEN e || jsonb_build_object('name','Management Fee 7% (Total CTC)','amount',1349.26,
      'percentage',7,'calcType','percentage','formulaMode','advanced','formulaExpression','total_ctc * 0.07',
      'costComponentId','03d34c22-9d21-4204-acf5-464caa60a29b','contractOverride',true)
    ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(r.employer_contributions) WITH ORDINALITY t(e, ord)
  WHERE e->>'name' NOT LIKE 'ER LWF%' AND e->>'name' NOT LIKE 'Billing Rate Adjustment%'),
  updated_at = now()
WHERE r.id = 'b83424f5-fdf5-4291-86c4-3e1596efc649';
COMMIT;
