import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildTallyVoucherRows } from "./tally-billing";
import { taxSplit, finalInvoiceGrandTotal } from "./gst-tax";

const base = {
  companyState: "Tamil Nadu",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  serviceTypeName: "Security Guard",
  gstOption: "csgst",
};

describe("Tally voucher matches the invoice (review I2)", () => {
  it("uses CGST+SGST when the site state differs only in spacing/case, like the invoice page", () => {
    const [row] = buildTallyVoucherRows({ ...base, unit: { billing_state: "TamilNadu" }, lines: [{ qty: 1, rate: 10000, amount: 10000, monthly: 26000 }] });
    expect(row["CGST Rate"]).toBe(9);
    expect(row["SGST Rate"]).toBe(9);
    expect(row["IGST Rate"]).toBe(0);
  });

  it("decides GST type from the site's own billing_state, not the customer fallback", () => {
    const [row] = buildTallyVoucherRows({
      ...base,
      unit: { billing_state: null, customer: { billing_state: "Tamil Nadu" } },
      lines: [{ qty: 1, rate: 10000, amount: 10000, monthly: 26000 }],
    });
    // Invoice page: unit billing_state blank -> not intra-state -> IGST.
    expect(row["IGST Rate"]).toBe(18);
  });

  it("honours the invoice's own intra-state decision when given", () => {
    const [row] = buildTallyVoucherRows({ ...base, unit: { billing_state: "Kerala" }, intraState: true, lines: [{ qty: 1, rate: 100, amount: 100, monthly: 100 }] });
    expect(row["CGST Rate"]).toBe(9);
  });

  it("adds configured extra charges and a round-off so the voucher total equals the printed grand total", () => {
    const lines = [
      { qty: 26, rate: 384.62, amount: 10000.12, monthly: 10000 },
      { qty: 3.5, rate: 384.62, amount: 1346.17, monthly: 10000 },
    ];
    const extras = [{ description: "Technical Allowance", amount: 500.25 }];
    const taxable = 10000.12 + 1346.17 + 500.25;
    const tax = taxSplit(taxable, false, "igst").total;
    const printed = finalInvoiceGrandTotal(taxable, tax);
    const rows = buildTallyVoucherRows({ ...base, unit: { billing_state: "Kerala" }, lines, extraCharges: extras, grandTotal: printed });
    expect(rows).toHaveLength(3);
    expect(rows[2]["Item Name"]).toBe("Technical Allowance");
    expect(rows[2]["Amt"]).toBe(500.25);
    const total = Math.round(rows.reduce((s, r) => s + Number(r["Total"]), 0) * 100) / 100;
    expect(total).toBe(printed);
    expect(rows[2]["Additional Ledger"]).toBe("Round Off");
  });

  it("leaves rows unchanged when no grand total is requested", () => {
    const [row] = buildTallyVoucherRows({ ...base, unit: { billing_state: "Kerala" }, lines: [{ qty: 1, rate: 100.33, amount: 100.33, monthly: 100 }] });
    expect(row["Additional Ledger"]).toBe("");
    expect(row["Total"]).toBe(118.39);
  });
});
