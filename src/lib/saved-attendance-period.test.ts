import { describe, expect, it } from "vitest";
import { resolveSavedAttendancePeriod } from "./saved-attendance-period";

const unit = "CLI4444";
const expected = { start: "2026-08-21", end: "2026-09-20" };
const september = { unit_id: unit, period_start: "2026-09-01", period_end: "2026-09-30" };

describe("saved attendance period", () => {
  it("uses CLI4444's saved 1–30 September instead of its new 21–20 contract window", () => {
    expect(resolveSavedAttendancePeriod(unit, expected, "2026-09", [september])).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("never borrows October attendance approval", () => {
    expect(resolveSavedAttendancePeriod(unit, expected, "2026-09", [{ ...september, period_start: "2026-09-21", period_end: "2026-10-20" }])).toEqual(expected);
  });
  it("keeps exact matches when multiple windows exist", () => {
    expect(resolveSavedAttendancePeriod(unit, expected, "2026-09", [september, { unit_id: unit, period_start: expected.start, period_end: expected.end }])).toEqual(expected);
  });
  it("does not guess between ambiguous saved windows", () => {
    expect(resolveSavedAttendancePeriod(unit, expected, "2026-09", [september, { ...september, period_start: "2026-09-02" }])).toEqual(expected);
  });
  it("never takes another client's period", () => {
    expect(resolveSavedAttendancePeriod(unit, expected, "2026-09", [{ ...september, unit_id: "CLI519" }])).toEqual(expected);
  });
});