\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE cli3619_preserved(kind text PRIMARY KEY, rows jsonb) ON COMMIT DROP;
INSERT INTO cli3619_preserved
SELECT 'other_resources',coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.contract_resources r
WHERE contract_id<>'5298edb2-5f3e-4d76-88e3-72c14f44861b'
UNION ALL SELECT 'contract_headers',coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.client_contracts c
WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6'
UNION ALL SELECT 'attendance',coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.attendance_entries a
WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6'
UNION ALL SELECT 'payroll_runs',coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.payroll_runs p
WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6'
UNION ALL SELECT 'payroll_snapshots',coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.payroll_run_snapshots p
WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6'
UNION ALL SELECT 'masters',coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]') FROM public.cost_components m
WHERE id IN ('cc142930-0001-4001-8001-000000000001','ead64358-9d85-441a-ad99-b8ce35430ed5');
CREATE TEMP TABLE cli3619_original AS SELECT id,to_jsonb(r)-'updated_at' row_data FROM public.contract_resources r
WHERE contract_id='5298edb2-5f3e-4d76-88e3-72c14f44861b';
\ir ../data-fixes/20261124_cli3619_verified_formulas.sql
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.contract_resources WHERE contract_id='5298edb2-5f3e-4d76-88e3-72c14f44861b'
  AND deductions->0->>'costComponentId'='cc142930-0001-4001-8001-000000000001'
  AND deductions->0->>'formulaExpression'='min(basic + da, 15000) * 0.12'
  AND (deductions->0->>'amount')::numeric=1800
  AND employer_contributions->0->>'costComponentId'='ead64358-9d85-441a-ad99-b8ce35430ed5'
  AND (employer_contributions->0->>'percentage')::numeric=13
  AND (employer_contributions->0->>'capAmount')::numeric=15000
  AND (employer_contributions->0->>'amount')::numeric=1950)<>2 THEN
  RAISE EXCEPTION 'Both saved roles must have the exact verified EPF links'; END IF;
 IF EXISTS(SELECT 1 FROM public.contract_resources r JOIN cli3619_original o USING(id)
   WHERE (to_jsonb(r)-ARRAY['updated_at','deductions','employer_contributions']) IS DISTINCT FROM
   (o.row_data-ARRAY['deductions','employer_contributions'])) THEN
   RAISE EXCEPTION 'Unrelated rate structure changed'; END IF;
 IF (SELECT rows FROM cli3619_preserved WHERE kind='other_resources') IS DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]') FROM public.contract_resources r WHERE contract_id<>'5298edb2-5f3e-4d76-88e3-72c14f44861b') THEN
   RAISE EXCEPTION 'Another client or historic resource changed'; END IF;
 IF (SELECT rows FROM cli3619_preserved WHERE kind='contract_headers') IS DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.client_contracts c WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6') THEN
   RAISE EXCEPTION 'Contract header or approval changed'; END IF;
 IF (SELECT rows FROM cli3619_preserved WHERE kind='attendance') IS DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.attendance_entries a WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6') THEN
   RAISE EXCEPTION 'Attendance changed'; END IF;
 IF (SELECT rows FROM cli3619_preserved WHERE kind='payroll_runs') IS DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.payroll_runs p WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6') THEN
   RAISE EXCEPTION 'Payroll run changed'; END IF;
 IF (SELECT rows FROM cli3619_preserved WHERE kind='payroll_snapshots') IS DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.payroll_run_snapshots p WHERE unit_id='ccd79c30-057f-4fd0-af5d-026714d024d6') THEN
   RAISE EXCEPTION 'Settled payroll changed'; END IF;
 IF (SELECT rows FROM cli3619_preserved WHERE kind='masters') IS DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]') FROM public.cost_components m WHERE id IN ('cc142930-0001-4001-8001-000000000001','ead64358-9d85-441a-ad99-b8ce35430ed5')) THEN
   RAISE EXCEPTION 'Shared formula definitions changed'; END IF;
END $test$;
\ir ../backups/cli3619-restore-20261124.sql
DO $test_restore$
BEGIN
 IF EXISTS(SELECT 1 FROM public.contract_resources r JOIN cli3619_original o USING(id)
   WHERE (to_jsonb(r)-'updated_at') IS DISTINCT FROM o.row_data) THEN
   RAISE EXCEPTION 'Restore failed to reproduce the exact original rate structure'; END IF;
END $test_restore$;
ROLLBACK;