import { describe, it, expect } from "vitest";
import { statutoryHead, ledgerAmount, inLedgerScope, originalUnitId } from "./statutory-heads";
describe("statutory aliases do not change liability", () => {
  it.each([
    "PT",
    "Professional Tax",
    "professional-tax",
    "EE PT — amendment v2",
    "49934 - Professional Tax - Sep 2026",
    "P.T.",
  ])("%s is Professional Tax", (name) => expect(statutoryHead(name)).toBe("pt"));
  it.each([
    ["PF", "epf"],
    ["EPF", "epf"],
    ["Provident Fund", "epf"],
    ["E.P.F. (EE)", "epf"],
    ["ESI", "esic"],
    ["ESI(EE)", "esic"],
    ["Employees’ State Insurance", "esic"],
    ["Labour Welfare Fund", "lwf"],
    ["Labor Welfare Fund", "lwf"],
    ["LWF", "lwf"],
    ["Security Guards Board levy", "levy"],
  ])("%s resolves to %s", (name, head) => expect(statutoryHead(name)).toBe(head));
  it.each([
    "Profit adjustment",
    "Transport allowance",
    "Special Allowance",
    "Other levy",
    "EDLI",
    "ADM Charges",
  ])("does not guess %s", (name) => expect(statutoryHead(name)).toBeNull());
  it("uses a legitimate computed zero", () =>
    expect(ledgerAmount({ amount: 200, computed_amount: 0 })).toBe(0));
  it("preserves negative adjustments", () => expect(ledgerAmount({ amount: -200 })).toBe(-200));
  it("does not present pending imported PT as posted payroll", () =>
    expect(inLedgerScope({ status: "active" }, "posted")).toBe(false));
  it("excludes cancelled records even in all scope", () =>
    expect(inLedgerScope({ status: "cancelled" }, "all")).toBe(false));
  it("retains completed deductions and processed contributions", () => {
    expect(inLedgerScope({ status: "completed" }, "posted")).toBe(true);
    expect(inLedgerScope({ status: "processed" }, "posted")).toBe(true);
  });
  it("keeps the original site after a move", () =>
    expect(originalUnitId({ unit_id: "old-site" }, new Map())).toBe("old-site"));
  it("recovers the original payroll site without borrowing current employee home", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    expect(
      originalUnitId(
        { source_kind: "payroll_amendment", source_ref: `payroll_run:${id}:v2` },
        new Map([[id, "old-site"]]),
      ),
    ).toBe("old-site");
    expect(originalUnitId({}, new Map())).toBeNull();
  });
});
