"""Rollback-first verification of the finance calculation generation only."""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
url = os.environ.get("RADIANT_PROD_DB_URL")
if not url:
    raise SystemExit("Production connection is unavailable")
migration = (ROOT / "db/prod-migrations/20261124175000_contract_payroll_segments_v4.sql").read_text()
checks = """
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.claim_finance_totals(integer)'::regprocedure) INTO definition;
 IF position('calculation_version<4' in definition)=0 THEN RAISE EXCEPTION 'claim must require calculation 4'; END IF;
 SELECT pg_get_functiondef('public.dispatch_finance_refresh()'::regprocedure) INTO definition;
 IF position('calculation_version<4' in definition)=0 THEN RAISE EXCEPTION 'dispatch must require calculation 4'; END IF;
 SELECT pg_get_functiondef('public.publish_finance_totals(jsonb)'::regprocedure) INTO definition;
 IF position('::integer>=4' in definition)=0 THEN RAISE EXCEPTION 'publish must reject older calculations'; END IF;
 IF has_function_privilege('authenticated','public.publish_finance_totals(jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.publish_finance_totals(jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.publish_finance_totals(jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Existing privileged publication boundary must be retained'; END IF;
END $$;
"""
finish = "COMMIT;" if "--apply" in sys.argv else "ROLLBACK;"
result = subprocess.run(["psql", url, "-X", "-v", "ON_ERROR_STOP=1"], input="BEGIN; SET LOCAL statement_timeout='30s';\n" + migration + checks + finish, text=True, env={**os.environ, "PGCONNECT_TIMEOUT": "15"}, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
if result.returncode:
    raise SystemExit("Finance version verification failed: " + result.stderr[-1200:])
print("Finance version and publication boundary verified; " + ("applied" if finish == "COMMIT;" else "rolled back"))