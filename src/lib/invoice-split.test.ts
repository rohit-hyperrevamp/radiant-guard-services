import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { totalsForPart, type InvoiceSplit } from "./invoice-split";
import { computeAttendanceTotals } from "./payroll-calc";

const split: InvoiceSplit = {
  parts: [{ key: "main", label: "Regular" }, { key: "ed", label: "Extra Duty / reliever" }],
  assign: { regular: "main", ph: "main", ed: "ed", reliever: "ed", extras: "main" },
};

describe("separate regular and Extra Duty invoices", () => {
  it("does not divide stored Extra Duty days by an eight-hour shift again", () => {
    const totals = computeAttendanceTotals(
      "employee",
      ["2026-09-01"],
      [{ candidate_id: "employee", entry_date: "2026-09-01", code: "P", ot_hours: 4 }],
      [{ code: "P", counts_as_present: true, is_paid: true, day_value: 1 }],
    );
    expect(totals.pDays).toBe(1);
    expect(totals.otDays).toBe(4);
    expect(totals.tDays).toBe(5);
  });

  it("allocates 26 regular plus 4 Extra Duty as 30 duties without counting either twice", () => {
    const totals = { pDays: 26, phDays: 0, otDays: 4, otHours: 4, tDays: 30 };
    const regular = totalsForPart(totals, true, split, "main");
    const extra = totalsForPart(totals, true, split, "ed");
    expect(regular.tDays).toBe(26);
    expect(extra.tDays).toBe(4);
    expect(regular.tDays + extra.tDays).toBe(30);
  });

  it("allocates a reliever's 4 duties only to the reliever invoice", () => {
    const totals = { pDays: 0, phDays: 0, otDays: 4, otHours: 4, tDays: 4 };
    expect(totalsForPart(totals, false, split, "main").tDays).toBe(0);
    expect(totalsForPart(totals, false, split, "ed").tDays).toBe(4);
  });
});