-- User-requested exact Security Guard rate copy: CLI4249 CON15885 -> CLI4267 CON16243.
-- Historical CON15900, source, staffing, day bases, contract terms and attendance stay unchanged.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE public.contract_resources IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE cli4267_before ON COMMIT DROP AS
SELECT * FROM public.contract_resources
WHERE contract_id IN ('c3a2a5db-3b91-46d2-b560-a810dd95e9ca',
                      '11111111-1111-4111-8111-159000000001',
                      'c0401108-2342-484c-9e15-acb811950257');

CREATE TABLE public.backup_cli4267_rates_20261107 AS
SELECT * FROM cli4267_before;
GRANT ALL ON public.backup_cli4267_rates_20261107 TO service_role;
ALTER TABLE public.backup_cli4267_rates_20261107 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE changed integer;
DECLARE rate_keys text[] := ARRAY['components','benefits','deductions','employer_contributions',
  'gross','shift_hours','round_off_final','round_off_totals','ot_multiplier','ot_basis',
  'ot_formula','ot_esi','ot_hourly_rate','ot_hourly_esic'];
BEGIN
  IF (SELECT count(*) FROM public.contract_resources r
      JOIN public.client_contracts c ON c.id=r.contract_id
      JOIN public.units u ON u.id=c.unit_id
      JOIN public.designations d ON d.id=r.designation_id
      WHERE (u.code='CLI4249' AND r.id='6ae5d170-1d7e-4122-ad66-95547cd592bd'
          OR u.code='CLI4267' AND r.id='3e8e549a-6244-4df5-b62d-7329edbe7867')
        AND c.status='active' AND d.name='Security Guard') <> 2 THEN
    RAISE EXCEPTION 'Expected source and target active Security Guard resources';
  END IF;

  UPDATE public.contract_resources t SET
    components=s.components, benefits=s.benefits, deductions=s.deductions,
    employer_contributions=s.employer_contributions, gross=s.gross,
    shift_hours=s.shift_hours, round_off_final=s.round_off_final,
    round_off_totals=s.round_off_totals, ot_multiplier=s.ot_multiplier,
    ot_basis=s.ot_basis, ot_formula=s.ot_formula, ot_esi=s.ot_esi,
    ot_hourly_rate=s.ot_hourly_rate, ot_hourly_esic=s.ot_hourly_esic
  FROM public.contract_resources s
  WHERE t.id='3e8e549a-6244-4df5-b62d-7329edbe7867'
    AND s.id='6ae5d170-1d7e-4122-ad66-95547cd592bd';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Expected exactly one updated resource'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.contract_resources t CROSS JOIN public.contract_resources s
    CROSS JOIN unnest(rate_keys) k
    WHERE t.id='3e8e549a-6244-4df5-b62d-7329edbe7867'
      AND s.id='6ae5d170-1d7e-4122-ad66-95547cd592bd'
      AND (to_jsonb(t)->k) IS DISTINCT FROM (to_jsonb(s)->k)
  ) THEN RAISE EXCEPTION 'Target rates differ from CLI4249'; END IF;

  IF EXISTS (
    SELECT 1 FROM cli4267_before b JOIN public.contract_resources r ON r.id=b.id
    WHERE CASE WHEN r.id='3e8e549a-6244-4df5-b62d-7329edbe7867'
      THEN (to_jsonb(r) - rate_keys - 'updated_at') IS DISTINCT FROM
           (to_jsonb(b) - rate_keys - 'updated_at')
      ELSE to_jsonb(r) IS DISTINCT FROM to_jsonb(b) END
  ) THEN RAISE EXCEPTION 'Source, history or non-rate fields changed'; END IF;
END $$;
COMMIT;