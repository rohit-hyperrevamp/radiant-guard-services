"""Run the exact correction and its preservation assertions without retaining data."""
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
migration = root / "db/prod-migrations/20261121090000_idbi_october_attendance_approval.sql"
sql = migration.read_text()
assert sql.rstrip().endswith("COMMIT;"), "Expected a transactional correction"
sql = sql.rstrip()[:-len("COMMIT;")] + "ROLLBACK;\n"
result = subprocess.run(
    ["psql", os.environ["RADIANT_PROD_DB_URL"], "-X", "-v", "ON_ERROR_STOP=1"],
    input=sql, text=True, capture_output=True,
)
if result.returncode:
    raise RuntimeError(result.stderr)
assert "Verified 37 approved IDBI October sheets" in result.stderr, result.stderr
assert "ROLLBACK" in result.stdout, "Test must not retain approval changes"
print("PASS: 37 IDBI October sheets approved; attendance and existing approvals preserved; rolled back")