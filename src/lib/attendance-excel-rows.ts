import { roundDutyDays } from "./duty-days";

/** Fold explicitly labelled hour rows into their preceding employee's daily marks. */
export function mergeAttendanceHourRows(
  rows: unknown[][],
  headerIndex: number,
  dates: Array<{ col: number; date: string }>,
  shiftForRow: (row: unknown[]) => number,
): unknown[][] {
  const header = rows[headerIndex] ?? [];
  const kindCol = header.findIndex((v) => /^(days|row type|type|att\/ot)$/i.test(String(v ?? "").trim()));
  if (kindCol < 0) return rows;
  const result = rows.map((row) => [...row]);
  let parentIndex: number | undefined;
  for (let index = headerIndex + 1; index < result.length; index++) {
    const row = result[index] ?? [];
    const kind = String(row[kindCol] ?? "").trim().toUpperCase();
    if (/^(ATT|ATTENDANCE)$/.test(kind)) {
      parentIndex = index;
      continue;
    }
    if (!/^(OT|ED|OT HRS|ED HRS|EXTRA DUTY)$/.test(kind)) {
      parentIndex = undefined;
      continue;
    }
    if (!dates.some(({ col }) => String(row[col] ?? "").trim())) {
      result[index] = [];
      continue;
    }
    const parent = parentIndex == null ? undefined : result[parentIndex];
    if (!parent) throw new Error("Extra Duty hours have no preceding employee attendance row. Nothing was replaced.");
    for (let col = 0; col < kindCol; col++) {
      if (String(row[col] ?? "").trim() && String(row[col]).trim() !== String(parent[col] ?? "").trim()) {
        throw new Error("Extra Duty row does not match the preceding employee. Nothing was replaced.");
      }
    }
    const shift = shiftForRow(parent);
    if (!Number.isFinite(shift) || shift <= 0) throw new Error("Cannot resolve the employee's shift for Extra Duty hours.");
    for (const { col } of dates) {
      const raw = String(row[col] ?? "").trim();
      if (!raw) continue;
      if (!/^\d+(?:\.\d+)?(?:\s*(?:HRS?|HOURS?))?$/i.test(raw)) {
        throw new Error(`Invalid Extra Duty hours: ${raw}. Nothing was replaced.`);
      }
      const hours = Number(raw.replace(/\s*(HRS?|HOURS?)$/i, ""));
      const mark = String(parent[col] ?? "").trim().toUpperCase();
      const parsed = mark.match(/^([A-Z]*)(?:\s*,\s*(\d+(?:\.\d+)?))?$/);
      if (!parsed) throw new Error("Attendance mark beside Extra Duty hours is invalid. Nothing was replaced.");
      parent[col] = `${parsed[1] ?? ""},${roundDutyDays(Number(parsed[2] ?? 0) + hours / shift)}`;
    }
    result[index] = [];
  }
  return result;
}