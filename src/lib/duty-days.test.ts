import { describe, expect, it } from "vitest";
import { roundDutyDays } from "./duty-days";
import { computeAttendanceTotals } from "./payroll-calc";
import { splitInvoiceDuties } from "./invoice-duty-rates";

describe("Extra Duty days are not rounded to 2 decimals (CLI290 35760)", () => {
  it("57.5 Extra Duty hours on an 8-hour shift stay 7.1875 days", () => {
    expect(roundDutyDays(57.5 / 8)).toBe(7.1875);
  });

  it("payroll attendance totals keep 7.1875 Extra Duty days", () => {
    const dates = Array.from({ length: 8 }, (_, i) => `2026-09-0${i + 1}`);
    const entries = dates.map((d, i) => ({
      candidate_id: "c1",
      entry_date: d,
      code: "P",
      ot_hours: i < 7 ? 1 : i === 7 ? 0.1875 : 0,
    }));
    const codes = [{ code: "P", counts_as_present: true, is_paid: true, day_value: 1 }];
    const t = computeAttendanceTotals("c1", dates, entries as never, codes as never);
    expect(t.otDays).toBe(7.1875);
  });

  it("invoice Extra Duty quantity stays 7.1875 days", () => {
    const s = splitInvoiceDuties({ billedDays: 37.1875, otDays: 7.1875, regularRate: 1000, extraDutyRate: 2000 });
    expect(s.edQuantity).toBe(7.1875);
    expect(s.regularQuantity).toBe(30);
  });
});

describe("printed invoice duty quantity", () => {
  it("prints 7.1875, not 7.19", async () => {
    const { formatDutyQty } = await import("./duty-days");
    expect(formatDutyQty(7.1875)).toBe("7.1875");
    expect(formatDutyQty(30)).toBe("30.00");
  });
  it("invoice annexure keeps 7.1875 Extra Duty days", async () => {
    const { misBillingLine } = await import("./mis-billing");
    const line = misBillingLine({ perDay: 1000, billedDays: 37.1875, otDays: 7.1875, total: 37187.5, intraState: true } as never);
    expect(line.otDays).toBe(7.1875);
  });
});
