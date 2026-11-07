import { describe, expect, it } from "vitest";
import { mergeAttendanceHourRows } from "./attendance-excel-rows";

const dates = [{ col: 3, date: "2026-09-02" }, { col: 4, date: "2026-09-03" }, { col: 5, date: "2026-09-20" }];
const header = ["Emp ID", "Designation", "Days", 2, 3, 20];

describe("separate attendance and Extra Duty hour rows", () => {
  it("retains all 40 source hours as five eight-hour duties, including hours on weekly off and PH", () => {
    const source = [header,
      [25894, "Security Guard", "Att", "W", "P", "P"], [null, null, "OT", 4, 8, null],
      [44096, "Security Guard", "Att", "P", "P", "P"], [null, null, "OT", 4, 8, null],
      [30497, "Security Guard", "Att", "P", "P", "PH"], [null, null, "OT", null, null, 8],
      [36228, "Security Guard", "Att", "P", "P", "PH"], [null, null, "OT", 2, 6, null]];
    const merged = mergeAttendanceHourRows(source, 0, dates, () => 8);
    const edDays = merged.slice(1).reduce((sum, row) => sum + dates.reduce((n, { col }) => n + Number(String(row[col] ?? "").split(",")[1] ?? 0), 0), 0);
    expect(edDays).toBe(5);
    expect(edDays * 8).toBe(40);
    expect(merged[1]?.[3]).toBe("W,0.5");
    expect(merged[5]?.[5]).toBe("PH,1");
    expect(source[1]?.[3]).toBe("W");
  });
  it("keeps 57.5 hours at eight hours as 7.1875 days", () => {
    expect(mergeAttendanceHourRows([header, [1, "Guard", "Att", "P"], [null, null, "OT", 57.5]], 0, dates, () => 8)[1]?.[3]).toBe("P,7.1875");
  });
  it("uses the employee shift rather than a fixed eight-hour divisor", () => {
    expect(mergeAttendanceHourRows([header, [1, "Guard", "Att", null], [null, null, "OT", 5]], 0, dates, () => 10)[1]?.[3]).toBe(",0.5");
  });
  it("leaves legacy inline cells and unlabelled workbooks unchanged", () => {
    const rows = [["Emp ID", "Designation", "Date", 2], [1, "Guard", null, "P,0.5"]];
    expect(mergeAttendanceHourRows(rows, 0, dates, () => 8)).toBe(rows);
  });
  it("rejects orphan or mismatched hour rows before replacement", () => {
    expect(() => mergeAttendanceHourRows([header, [null, null, "OT", 4]], 0, dates, () => 8)).toThrow("no preceding employee");
    expect(() => mergeAttendanceHourRows([header, [1, "Guard", "Att", "P"], [2, null, "OT", 4]], 0, dates, () => 8)).toThrow("does not match");
  });
  it("rejects invalid numeric hours rather than dropping them", () => {
    expect(() => mergeAttendanceHourRows([header, [1, "Guard", "Att", "P"], [null, null, "OT", "four?"]], 0, dates, () => 8)).toThrow("Invalid Extra Duty");
  });
});