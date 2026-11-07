import { describe, expect, it } from "vitest";
import { visibleAttendanceCandidateIds } from "./attendance-roster-eligibility";

describe("CLI2967 attendance roster", () => {
  const candidates = ["45087", "43280", "20999", "29436", "46470"].map((id) => ({ id, unit_id: id === "45087" ? "CLI2967" : "elsewhere", is_enabled: true, status: "active" }));
  it("bills only the visible 25 Present and 1 ED, not 17 hidden ED", () => {
    const visible = new Set(visibleAttendanceCandidateIds("CLI2967", candidates, ["43280"], []));
    const days = new Map([["45087", 25], ["43280", 1], ["20999", 1], ["29436", 6], ["46470", 10]]);
    expect([...days].filter(([id]) => visible.has(id)).reduce((sum, [, qty]) => sum + qty, 0)).toBe(26);
    expect([...visible]).toEqual(["45087", "43280"]);
  });
  it("retains explicitly scoped approved staff", () => {
    expect(visibleAttendanceCandidateIds("CLI2967", [{ id: "scoped", unit_id: null, is_enabled: true, status: "approved" }], [], ["scoped"])).toEqual(["scoped"]);
  });
  it("does not restore disabled or inactive staff hidden from attendance", () => {
    expect(visibleAttendanceCandidateIds("CLI2967", [{ id: "disabled", unit_id: "CLI2967", is_enabled: false, status: "active" }, { id: "inactive", unit_id: "CLI2967", is_enabled: true, status: "inactive" }], [], [])).toEqual([]);
  });
});