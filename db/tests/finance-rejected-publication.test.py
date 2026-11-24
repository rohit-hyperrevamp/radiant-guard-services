"""Rollback-first checks for old-worker backoff without changing saved money."""
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
migration = (root / "db/prod-migrations/20261124182500_finance_rejected_publication_backoff.sql").read_text()
checks = """
CREATE TEMP TABLE finance_test_before AS SELECT * FROM public.finance_period_totals
 WHERE calculation_version=4 AND calculated_generation=generation AND totals IS NOT NULL
 ORDER BY unit_id,period_start,period_end LIMIT 1;
DO $$
DECLARE r public.finance_period_totals; lease uuid := gen_random_uuid(); published integer;
BEGIN
 SELECT * INTO r FROM finance_test_before;
 IF NOT FOUND THEN RAISE EXCEPTION 'A current version-4 fixture is required'; END IF;
 UPDATE public.finance_period_totals SET lease_token=lease,lease_until=now()+interval '5 minutes'
  WHERE (unit_id,period_start,period_end)=(r.unit_id,r.period_start,r.period_end);
 SELECT public.publish_finance_totals(jsonb_build_array(jsonb_build_object(
  'unit_id',r.unit_id,'period_start',r.period_start,'period_end',r.period_end,
  'generation',r.generation,'lease_token',lease,'calculation_version',2,'totals',r.totals))) INTO published;
 IF published<>0 THEN RAISE EXCEPTION 'Version 2 must not replace corrected totals'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_period_totals t WHERE
  (t.unit_id,t.period_start,t.period_end)=(r.unit_id,r.period_start,r.period_end)
  AND t.totals=r.totals AND t.calculation_version=4 AND t.calculated_generation=r.calculated_generation
  AND t.lease_token IS NULL AND t.retry_after>=now()+interval '59 minutes' AND t.last_error IS NOT NULL)
  THEN RAISE EXCEPTION 'Rejected old worker must back off without changing saved money'; END IF;
 lease:=gen_random_uuid();
 UPDATE public.finance_period_totals SET lease_token=lease,lease_until=now()+interval '5 minutes'
  WHERE (unit_id,period_start,period_end)=(r.unit_id,r.period_start,r.period_end);
 SELECT public.publish_finance_totals(jsonb_build_array(jsonb_build_object(
  'unit_id',r.unit_id,'period_start',r.period_start,'period_end',r.period_end,
  'generation',r.generation,'lease_token',lease,'calculation_version',4,'totals',r.totals))) INTO published;
 IF published<>1 THEN RAISE EXCEPTION 'Current worker must still publish successfully'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_period_totals t WHERE
  (t.unit_id,t.period_start,t.period_end)=(r.unit_id,r.period_start,r.period_end)
  AND t.totals=r.totals AND t.retry_after IS NULL AND t.last_error IS NULL)
  THEN RAISE EXCEPTION 'Successful current publication must clear retry and errors'; END IF;
 lease:=gen_random_uuid();
 UPDATE public.finance_period_totals SET lease_token=lease,lease_until=now()+interval '5 minutes'
  WHERE (unit_id,period_start,period_end)=(r.unit_id,r.period_start,r.period_end);
 SELECT public.publish_finance_totals(jsonb_build_array(jsonb_build_object(
  'unit_id',r.unit_id,'period_start',r.period_start,'period_end',r.period_end,
  'generation',r.generation-1,'lease_token',lease,'calculation_version',4,'totals',r.totals))) INTO published;
 IF published<>0 THEN RAISE EXCEPTION 'Changed source generation must not publish'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finance_period_totals t WHERE
  (t.unit_id,t.period_start,t.period_end)=(r.unit_id,r.period_start,r.period_end)
  AND t.totals=r.totals AND t.retry_after IS NULL AND t.lease_token IS NULL)
  THEN RAISE EXCEPTION 'Changed sources must release the lease without delaying a fresh calculation'; END IF;
 IF has_function_privilege('anon','public.publish_finance_totals(jsonb)','execute')
  OR has_function_privilege('authenticated','public.publish_finance_totals(jsonb)','execute')
  OR NOT has_function_privilege('service_role','public.publish_finance_totals(jsonb)','execute')
  THEN RAISE EXCEPTION 'Publication privileges must stay unchanged'; END IF;
END $$;
"""
url = os.environ.get("RADIANT_PROD_DB_URL")
if not url:
    raise SystemExit("Production connection is required")
apply = "--apply" in sys.argv
finish = "COMMIT;" if apply else "ROLLBACK;"
# Test fixtures always roll back; applying only installs the verified function.
sql = "BEGIN; SET LOCAL statement_timeout='30s';\n" + migration + checks + "ROLLBACK;\n"
if apply:
    sql += "BEGIN;\n" + migration + finish
result = subprocess.run(["psql", url, "-X", "-v", "ON_ERROR_STOP=1"], input=sql,
    text=True, capture_output=True, env={**os.environ,"PGCONNECT_TIMEOUT":"15"}, timeout=90)
if result.returncode:
    raise SystemExit("Finance publication verification failed: " + result.stderr[-1400:])
assert "ROLLBACK" in result.stdout, "Fixture changes must always be rolled back"
if apply:
    assert "COMMIT" in result.stdout, "Only the verified function is applied"
print("PASS: version-2 rejection, retry backoff, current publication, generation checks and unchanged privileges; "
      + ("function applied" if apply else "rolled back"))