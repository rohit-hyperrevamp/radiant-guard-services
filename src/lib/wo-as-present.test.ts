import { describe, expect, it } from "vitest";
import { computeAttendanceTotals } from "./payroll-calc";

const codes = [
  { code: "P", counts_as_present: true, is_paid: true, day_value: 1 },
  { code: "WO", counts_as_present: false, is_paid: true, day_value: 1 },
];
const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
const entries = [
  { candidate_id: "x", entry_date: "2026-09-01", code: "P", ot_hours: 0 },
  { candidate_id: "x", entry_date: "2026-09-02", code: "P", ot_hours: 0 },
  { candidate_id: "x", entry_date: "2026-09-03", code: "WO", ot_hours: 0 },
];

describe("contract: count Week Off as Present", () => {
  it("WO is not a P day when the contract switch is off", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(computeAttendanceTotals("x", dates, entries as any, codes as any).pDays).toBe(2);
  });
  it("WO counts as a P day when the contract switch is on", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(computeAttendanceTotals("x", dates, entries as any, codes as any, null, null, null, true).pDays).toBe(3);
  });
});
