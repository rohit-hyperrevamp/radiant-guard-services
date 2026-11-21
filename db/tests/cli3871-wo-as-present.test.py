"""Test the client-only correction with production assertions, then roll it back."""
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
sql = (root / "db/prod-migrations/20261121115000_cli3871_wo_as_present.sql").read_text()
assert sql.rstrip().endswith("COMMIT;"), "Expected transactional correction"
sql = sql.rstrip()[:-len("COMMIT;")] + "ROLLBACK;\n"
result = subprocess.run(
    ["psql", os.environ["RADIANT_PROD_DB_URL"], "-X", "-v", "ON_ERROR_STOP=1"],
    input=sql, text=True, capture_output=True,
)
if result.returncode:
    raise RuntimeError(result.stderr)
assert "Verified CLI3871 WO as P" in result.stderr, result.stderr
assert "ROLLBACK" in result.stdout, "Test must not retain changes"
print("PASS: CLI3871 WO as P; other clients, historical contracts, rates and attendance preserved; rolled back")