import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { diffAttendance, snapshotKeyOf, type AttendanceSnapshotEntry } from "./attendance-versions";

const row = (p: Partial<AttendanceSnapshotEntry>): AttendanceSnapshotEntry => ({
  candidate_id: "c1",
  designation_id: "d1",
  entry_date: "2026-11-03",
  code: "P",
  ot_hours: 0,
  shift_hours: 8,
  is_reliever: false,
  ...p,
});

describe("attendance version snapshot key", () => {
  it("keeps a regular and a reliever line on the same date apart", () => {
    expect(snapshotKeyOf(row({}))).not.toBe(snapshotKeyOf(row({ is_reliever: true })));
  });

  it("keeps 8h and 12h lines on the same date apart", () => {
    expect(snapshotKeyOf(row({}))).not.toBe(snapshotKeyOf(row({ shift_hours: 12 })));
  });

  it("detects a change on only the reliever line", () => {
    const before = [row({}), row({ is_reliever: true, code: "ED" })];
    const after = [row({}), row({ is_reliever: true, code: "A" })];
    const diff = diffAttendance(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ isReliever: true, beforeCode: "ED", afterCode: "A", shiftHours: 8 });
  });

  it("does not flag every row when comparing a legacy snapshot without line identity", () => {
    const legacy = [{ candidate_id: "c1", designation_id: "d1", entry_date: "2026-11-03", code: "P", ot_hours: 0 }];
    expect(diffAttendance(legacy, [row({})])).toHaveLength(0);
  });
});

describe("legacy snapshot diff ignores reliever lines (review round 2)", () => {
  it("compares a v1 snapshot only against the regular line on that date", () => {
    const before = [{ candidate_id: "c1", designation_id: "d1", entry_date: "2026-11-03", code: "P", ot_hours: 0 }];
    const after = [
      { candidate_id: "c1", designation_id: "d1", entry_date: "2026-11-03", code: "P", ot_hours: 0, shift_hours: 8, is_reliever: false },
      { candidate_id: "c1", designation_id: "d1", entry_date: "2026-11-03", code: "ED", ot_hours: 1, shift_hours: 8, is_reliever: true },
    ];
    expect(diffAttendance(before as never, after as never)).toEqual([]);
  });
});
