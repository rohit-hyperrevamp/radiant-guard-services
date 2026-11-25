import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
}));
import { resolvePayrollWindowsByUnit } from "./payroll-period";

const windows = [
  { id: "w1", window_start_day: 1, window_end_day: 31 },
  { id: "w2", window_start_day: 26, window_end_day: 25 },
];

describe("resolvePayrollWindowsByUnit", () => {
  it("uses the newest contract with a window, only for requested units", () => {
    const contracts = [
      { unit_id: "U1", payroll_window_id: null },
      { unit_id: "U1", payroll_window_id: "w2" },
      { unit_id: "U1", payroll_window_id: "w1" },
      { unit_id: "U2", payroll_window_id: "w1" },
      { unit_id: "U3", payroll_window_id: "w2" },
    ];
    const out = resolvePayrollWindowsByUnit(["U1", "U2"], contracts, windows);
    expect(out.get("U1")).toEqual({ windowStartDay: 26, windowEndDay: 25 });
    expect(out.get("U2")).toEqual({ windowStartDay: 1, windowEndDay: 31 });
    expect(out.has("U3")).toBe(false);
  });

  it("skips units whose window row is missing", () => {
    const out = resolvePayrollWindowsByUnit(["U1"], [{ unit_id: "U1", payroll_window_id: "gone" }], windows);
    expect(out.size).toBe(0);
  });
});
