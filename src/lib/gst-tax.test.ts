import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { finalInvoiceTax, taxSplit } from "./gst-tax";
import { misBillingLine } from "./mis-billing";
import { buildTallyVoucherRows } from "./tally-billing";
import { periodGstOption } from "./contract-gst";

describe("contract GST opt-out", () => {
  it("excludes GST from taxable services and extra charges for either state split", () => {
    for (const intraState of [true, false]) {
      expect(taxSplit(10500, intraState, "none")).toEqual({ cgst: 0, sgst: 0, igst: 0, total: 0 });
    }
  });
  it("preserves GST for enabled and legacy contracts", () => {
    expect(taxSplit(10000, true, "csgst")).toEqual({ cgst: 900, sgst: 900, igst: 0, total: 1800 });
    expect(taxSplit(10000, false)).toEqual({ cgst: 0, sgst: 0, igst: 1800, total: 1800 });
  });
  it("issues a GST-disabled invoice with zero tax and excludes disabled sites from mixed totals", () => {
    expect(finalInvoiceTax([{ taxableValue: 10000, gstOption: "none" }], true)).toBe(0);
    expect(finalInvoiceTax([{ taxableValue: 10000, gstOption: "none" }, { taxableValue: 10000, gstOption: "csgst" }], true)).toBe(1800);
  });
  it("exports MIS without tax or an inflated grand total", () => {
    const line = misBillingLine({ perDay: 1000, billedDays: 10, otDays: 0, total: 10000, intraState: true, gstOption: "none" });
    expect(line.gstTotal).toBe(0);
    expect(line.grandTotal).toBe(10000);
  });
  it("exports Tally without tax rates or tax ledgers", () => {
    const [row] = buildTallyVoucherRows({ unit: { billing_state: "Maharashtra" }, companyState: "Maharashtra", periodStart: "2026-09-01", periodEnd: "2026-09-30", serviceTypeName: "Security Guard", gstOption: "none", lines: [{ qty: 10, rate: 1000, amount: 10000, monthly: 26000 }] });
    expect(row["Total"]).toBe(10000);
    for (const tax of ["CGST", "SGST", "IGST"]) {
      expect(row[`${tax} Rate`]).toBe(0);
      expect(row[`${tax} Ledger`]).toBe("");
    }
  });
  it("uses the historical period contract instead of a newer enabled contract", () => {
    expect(periodGstOption([
      { unit_id: "site", start_date: "2026-10-01", end_date: null, status: "active", gst_option: "csgst" },
      { unit_id: "site", start_date: "2026-04-01", end_date: "2026-09-30", status: "expired", gst_option: "none" },
    ], { unitId: "site", periodStart: "2026-09-01", periodEnd: "2026-09-30" })).toBe("none");
  });
});
import { finalInvoiceGrandTotal, invoiceCompanyState, isIntraStateSupply, istDateISO } from "./gst-tax";

describe("final invoice helpers (review I3/I4/I8)", () => {
  it("stores the rupee-rounded grand total that the print shows", () => {
    expect(finalInvoiceGrandTotal(10000.3, 1800.05)).toBe(11800);
    expect(finalInvoiceGrandTotal(10000.45, 1800.08)).toBe(11801);
  });
  it("uses org_settings.company_state when no GST branch matches, not a hardcoded Maharashtra", () => {
    expect(invoiceCompanyState(null, "Karnataka")).toBe("Karnataka");
    expect(isIntraStateSupply("Karnataka", invoiceCompanyState(undefined, "Karnataka"))).toBe(true);
    expect(isIntraStateSupply("Maharashtra", invoiceCompanyState(undefined, "Karnataka"))).toBe(false);
    expect(invoiceCompanyState("Tamil Nadu", "Karnataka")).toBe("Tamil Nadu");
  });
  it("defaults the invoice date to the IST calendar date", () => {
    // 1 April 00:30 IST = 31 March 19:00 UTC: the new financial year in India.
    expect(istDateISO(new Date("2026-03-31T19:00:00Z"))).toBe("2026-04-01");
    expect(istDateISO(new Date("2026-04-01T18:29:00Z"))).toBe("2026-04-01");
    expect(istDateISO(new Date("2026-04-01T18:30:00Z"))).toBe("2026-04-02");
  });
});
