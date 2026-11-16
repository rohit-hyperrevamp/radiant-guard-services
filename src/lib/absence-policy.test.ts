import { describe, expect, it } from "vitest";
import { continuousAbsence, DEFAULT_ABSENCE_POLICY, validateAbsencePolicy } from "./absence-policy";

describe("guard absence policy", () => {
  it("defaults to 10-day warning and minimum 15-day approval, disabled until enabled", () => {
    expect(DEFAULT_ABSENCE_POLICY.termination_days).toBe(15);
    expect(DEFAULT_ABSENCE_POLICY.warning_days).toContain(10);
    expect(DEFAULT_ABSENCE_POLICY.enabled).toBe(false);
    expect(DEFAULT_ABSENCE_POLICY.termination_enabled).toBe(false);
  });
  it("refuses thresholds below 15", () => {
    expect(validateAbsencePolicy({ ...DEFAULT_ABSENCE_POLICY, termination_days: 14 })).not.toBeNull();
    expect(validateAbsencePolicy({ ...DEFAULT_ABSENCE_POLICY, termination_days: 15 })).toBeNull();
  });
  it("requires a warning before termination", () => {
    expect(validateAbsencePolicy({ ...DEFAULT_ABSENCE_POLICY, warning_days: [15, 20] })).not.toBeNull();
  });
  it("does not apply to other employee roles", () => {
    expect(validateAbsencePolicy({ ...DEFAULT_ABSENCE_POLICY, role_keys: ["field_officer"] })).not.toBeNull();
  });
  it("counts missing attendance on assigned days", () => {
    expect(continuousAbsence(Array.from({ length: 15 }, (_, n) => ({ date: String(n), assigned: true, worked: false, excused: false })))).toBe(15);
  });
  it("work at any site breaks continuous absence", () => {
    expect(continuousAbsence([{ date: "3", assigned: true, worked: false, excused: false }, { date: "2", assigned: true, worked: true, excused: false }, { date: "1", assigned: true, worked: false, excused: false }])).toBe(1);
  });
  it("leave and weekly off break the streak", () => {
    expect(continuousAbsence([{ date: "2", assigned: true, worked: false, excused: true }, { date: "1", assigned: true, worked: false, excused: false }])).toBe(0);
  });
  it("unassigned dates cannot count", () => {
    expect(continuousAbsence([{ date: "1", assigned: false, worked: false, excused: false }])).toBe(0);
  });
});