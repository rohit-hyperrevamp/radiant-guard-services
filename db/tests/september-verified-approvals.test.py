"""Rollback-first integration checks for September approval and source preservation."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
operation = ROOT / "db/operations/20261124_september_verified_payroll_approvals.sql"
url = os.environ.get("RADIANT_PROD_DB_URL")
review = os.environ.get("SEPTEMBER_APPROVAL_REVIEW_FILE")
if not url or not review:
    raise SystemExit("Production connection and a freshly calculated review file are required")
if not Path(review).is_file():
    raise SystemExit("The source-engine review file is missing")

command = ["psql", url, "-X", "-v", "ON_ERROR_STOP=1", "-v", f"review_file={review}"]
if "--apply" in sys.argv:
    command += ["-v", "apply_changes=1"]
result = subprocess.run(command + ["-f", str(operation)], text=True, capture_output=True,
                        env={**os.environ, "PGCONNECT_TIMEOUT": "15"}, timeout=240)
if result.returncode:
    raise SystemExit("September approval verification failed: " + result.stderr[-1600:])
assert "unresolved exceptions and all money sources preserved" in result.stderr, result.stderr
if "--apply" not in sys.argv:
    assert "ROLLBACK" in result.stdout, "The verification must roll back all approval and finance changes"
else:
    assert "COMMIT" in result.stdout, "Application must commit only after every preservation assertion passes"
print(result.stdout[-1500:])
print(result.stderr[-500:])
print("PASS: eligible approvals, source-exception isolation, exact finance readback and source preservation")