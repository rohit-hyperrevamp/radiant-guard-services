"""Import explicit October 2026 Karnataka workbook cells, never summary totals.

Read-only by default. --apply writes a verified, atomic production transaction.
No employee source data or workbook copies belong in the repository.
"""
import argparse
import collections
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse

import openpyxl


def daily_cells(values):
    """The first 31 cells are dates; everything after them is a summary."""
    result = []
    for day, value in enumerate(list(values)[:31], 1):
        if value is None or str(value).strip() == "":
            continue
        mark = str(value).strip().upper()
        if mark not in {"P", "A", "W", "H"}:
            raise ValueError(f"Unsupported daily mark {mark!r} on day {day}")
        result.append({"date": f"2026-10-{day:02d}", "code": "PH" if mark == "H" else mark})
    return result


def workbook_rows(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    result = []
    for sheet in workbook:
        if sheet.title == "Review Notes":
            continue
        header = str(sheet.cell(1, 1).value or "")
        match = re.search(r"\bCLI\d+\b", header)
        for number, cells in enumerate(sheet.iter_rows(values_only=True), 1):
            if len(cells) < 6 or cells[5] != "Attendance":
                continue
            result.append({
                "sheet": sheet.title, "row": number,
                "client": match.group() if match else None,
                "employee": str(cells[1]), "name": str(cells[2]),
                "branch": str(cells[3]), "designation": str(cells[4]),
                "days": daily_cells(cells[6:37]),
            })
    workbook.close()
    return result


def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def production_sql(sql):
    url = os.environ.get("RADIANT_PROD_DB_URL", "")
    if urlparse(url).hostname != "db.yimpxawqoarprhtxapie.supabase.co":
        raise RuntimeError("Production database host is not the approved host")
    process = subprocess.run(
        ["psql", url, "-X", "-At", "-v", "ON_ERROR_STOP=1"],
        input=sql, text=True, capture_output=True,
    )
    if process.returncode:
        raise RuntimeError(process.stderr)
    return process.stdout.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook")
    parser.add_argument("--output", default="/tmp/ka-attendance")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    rows = workbook_rows(args.workbook)
    employee_codes = ",".join(sql_literal(r["employee"]) for r in rows)
    context = json.loads(production_sql(f"""
      SELECT jsonb_build_object(
        'employees', (SELECT jsonb_agg(to_jsonb(c)) FROM
          (SELECT id, employee_code, full_name, status, is_enabled, unit_id, designation_id
           FROM candidates WHERE employee_code IN ({employee_codes})) c),
        'units', (SELECT jsonb_agg(to_jsonb(u)) FROM
          (SELECT id, code, name, status FROM units) u),
        'contracts', (SELECT jsonb_agg(to_jsonb(r)) FROM
          (SELECT cc.unit_id, cr.designation_id, d.name designation, cr.shift_hours
           FROM client_contracts cc JOIN contract_resources cr ON cr.contract_id=cc.id
           JOIN designations d ON d.id=cr.designation_id
           WHERE cc.status='active' AND cc.start_date<='2026-10-01'
           AND cc.end_date>='2026-10-31') r),
        'entries', (SELECT jsonb_agg(to_jsonb(a)) FROM
          (SELECT a.* FROM attendance_entries a JOIN candidates c ON c.id=a.candidate_id
           WHERE c.employee_code IN ({employee_codes})
           AND a.entry_date BETWEEN '2026-10-01' AND '2026-10-31') a));
    """))
    units = {u["code"]: u for u in context["units"]}
    employees = collections.defaultdict(list)
    for employee in context["employees"] or []:
        employees[employee["employee_code"]].append(employee)
    entries = context["entries"] or []
    expected, skipped, summary = [], [], []
    for row in rows:
        if not row["days"]:
            skipped.append({**row, "reason": "No daily marks; summary totals ignored"})
            continue
        client = row["client"]
        if client is None:
            # Both floor names and these employee assignments were verified in production.
            client = "CLI4680" if "8th Floor" in row["branch"] else (
                "CLI4682" if "6th Floor" in row["branch"] else None)
        unit = units.get(client)
        matches = employees[row["employee"]]
        reason = None
        if unit is None:
            reason = "Client not uniquely matched"
        elif unit["status"] != "active":
            reason = "Inactive client held pending user choice; no reactivation"
        elif len(matches) != 1:
            reason = "Employee ID not uniquely matched"
        elif not matches[0]["is_enabled"] or matches[0]["status"] not in {"active", "approved"}:
            reason = "Employee is not currently eligible; record unchanged"
        if reason:
            skipped.append({**row, "reason": reason})
            continue
        employee = matches[0]
        resources = [r for r in context["contracts"] or [] if r["unit_id"] == unit["id"]
                     and r["designation"] == row["designation"]]
        keys = {(r["designation_id"], r["shift_hours"]) for r in resources}
        if len(keys) != 1:
            skipped.append({**row, "reason": "Contract designation/shift is ambiguous"})
            continue
        designation, shift = next(iter(keys))
        existing = [a for a in entries if a["unit_id"] == unit["id"]
                    and a["candidate_id"] == employee["id"]]
        line_keys = {(a["designation_id"], a["shift_hours"]) for a in existing}
        if len(line_keys) > 1:
            skipped.append({**row, "reason": "Multiple saved attendance lines; no guessed replacement"})
            continue
        if line_keys:
            # Attendance-only import preserves the saved designation (including older mappings).
            designation, shift = next(iter(line_keys))
        added, changed, same = 0, 0, 0
        for day in row["days"]:
            found = [a for a in existing if a["entry_date"] == day["date"]]
            if len(found) > 1:
                raise ValueError("Duplicate daily lines need explicit review")
            current = found[0] if found else None
            source = (current["rule_orig_code"] if current and current["rule_applied"]
                      else current["code"] if current else None)
            source_ed = (current["rule_orig_ot"] if current and current["rule_applied"]
                         else current["ot_hours"] if current else None)
            action = "same" if current and source == day["code"] and float(source_ed or 0) == 0 else (
                "change" if current else "add")
            same += action == "same"
            changed += action == "change"
            added += action == "add"
            expected.append({"unit_id": unit["id"], "candidate_id": employee["id"],
                             "designation_id": designation, "shift_hours": shift,
                             "entry_date": day["date"], "code": day["code"],
                             "action": action, "existing_id": current["id"] if current else None})
        summary.append({"sheet": row["sheet"], "client": client, "employee": row["employee"],
                        "name": row["name"], "matched": same, "added": added, "changed": changed})

    manifest = {"source": Path(args.workbook).name, "rows": summary, "skipped": skipped,
                "daily_cells": len(expected), "changes": dict(collections.Counter(e["action"] for e in expected))}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2))
    payload = sql_literal(json.dumps(expected))
    sql = f"""
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE ka_expected ON COMMIT DROP AS
 SELECT * FROM jsonb_to_recordset({payload}::jsonb) AS x
 (unit_id uuid, candidate_id uuid, designation_id uuid, shift_hours smallint,
  entry_date date, code text, action text, existing_id uuid);
CREATE TEMP TABLE ka_before ON COMMIT DROP AS
 SELECT a.* FROM attendance_entries a
 WHERE a.candidate_id IN (SELECT candidate_id FROM ka_expected);
CREATE TEMP TABLE ka_sheets_before ON COMMIT DROP AS
 SELECT s.* FROM attendance_sheets s WHERE s.unit_id IN (SELECT unit_id FROM ka_expected);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM payroll_runs r JOIN ka_expected k ON k.unit_id=r.unit_id
   AND k.entry_date BETWEEN r.period_start AND r.period_end
   WHERE k.action<>'same' AND (r.payroll_status='processed' OR r.invoice_status='processed'))
 THEN RAISE EXCEPTION 'Processed period refused'; END IF;
 IF EXISTS (SELECT 1 FROM attendance_sheets s JOIN ka_expected k ON k.unit_id=s.unit_id
   AND k.entry_date BETWEEN s.period_start AND s.period_end
   WHERE k.action<>'same' AND s.status='approved')
 THEN RAISE EXCEPTION 'Approved sheet refused; amendment needed'; END IF;
 IF EXISTS (SELECT 1 FROM ka_expected k LEFT JOIN attendance_entries a ON a.id=k.existing_id
   WHERE k.action='same' AND (a.id IS NULL OR
   (CASE WHEN a.rule_applied THEN a.rule_orig_code ELSE a.code END) IS DISTINCT FROM k.code OR
   coalesce(CASE WHEN a.rule_applied THEN a.rule_orig_ot ELSE a.ot_hours END,0)<>0))
 THEN RAISE EXCEPTION 'Source changed since preflight'; END IF;
 IF EXISTS (SELECT 1 FROM attendance_entries a JOIN ka_expected k ON a.unit_id=k.unit_id
   AND a.candidate_id=k.candidate_id AND a.entry_date=k.entry_date
   WHERE k.action='add') THEN RAISE EXCEPTION 'New source day already exists'; END IF;
END $$;
UPDATE attendance_entries a SET code=k.code, ot_hours=0,
 rule_applied=false, rule_orig_code=NULL, rule_orig_ot=NULL, ed_from_cap=false
FROM ka_expected k WHERE k.action='change' AND a.id=k.existing_id;
INSERT INTO attendance_entries
 (unit_id,candidate_id,designation_id,shift_hours,entry_date,code,ot_hours,is_reliever)
 SELECT unit_id,candidate_id,designation_id,shift_hours,entry_date,code,0,false
 FROM ka_expected WHERE action='add';
INSERT INTO attendance_sheets (unit_id,period_start,period_end,status)
 SELECT DISTINCT unit_id,DATE '2026-10-01',DATE '2026-10-31','draft' FROM ka_expected k
 WHERE NOT EXISTS (SELECT 1 FROM attendance_sheets s WHERE s.unit_id=k.unit_id
   AND s.period_start<='2026-10-31' AND s.period_end>='2026-10-01')
 ON CONFLICT (unit_id,period_start,period_end) DO NOTHING;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM ka_expected k LEFT JOIN attendance_entries a ON a.unit_id=k.unit_id
   AND a.candidate_id=k.candidate_id AND a.designation_id IS NOT DISTINCT FROM k.designation_id
   AND a.shift_hours=k.shift_hours AND a.entry_date=k.entry_date
   WHERE a.id IS NULL OR (CASE WHEN a.rule_applied THEN a.rule_orig_code ELSE a.code END)
     IS DISTINCT FROM k.code OR
     coalesce(CASE WHEN a.rule_applied THEN a.rule_orig_ot ELSE a.ot_hours END,0)<>0)
 THEN RAISE EXCEPTION 'Saved daily source does not match workbook'; END IF;
 IF EXISTS (SELECT 1 FROM ka_before b LEFT JOIN attendance_entries a ON a.id=b.id
   WHERE NOT EXISTS (SELECT 1 FROM ka_expected k WHERE k.existing_id=b.id AND k.action='change')
   AND to_jsonb(a) IS DISTINCT FROM to_jsonb(b))
 THEN RAISE EXCEPTION 'Existing matched or unrelated employee attendance changed'; END IF;
 IF EXISTS (SELECT 1 FROM ka_sheets_before b LEFT JOIN attendance_sheets s ON s.id=b.id
   WHERE to_jsonb(s) IS DISTINCT FROM to_jsonb(b))
 THEN RAISE EXCEPTION 'Existing attendance sheet changed'; END IF;
END $$;
SELECT jsonb_build_object('verified_days',(SELECT count(*) FROM ka_expected),
 'added',(SELECT count(*) FROM ka_expected WHERE action='add'),
 'changed',(SELECT count(*) FROM ka_expected WHERE action='change'),
 'unchanged',(SELECT count(*) FROM ka_expected WHERE action='same'));
COMMIT;
"""
    (output / "apply.sql").write_text(sql)
    if args.apply:
        manifest["result"] = production_sql(sql)
        manifest["applied_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({k: manifest[k] for k in ("daily_cells", "changes")}, indent=2))
    for row in summary:
        print(row)
    for row in skipped:
        print(row["sheet"], row["employee"], row["reason"])


if __name__ == "__main__":
    main()