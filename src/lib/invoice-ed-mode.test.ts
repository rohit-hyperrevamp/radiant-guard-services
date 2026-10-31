import { describe, expect, it } from "vitest";
import { applyInvoiceEdMode, DEFAULT_SPLIT, totalsForPart } from "./invoice-split";
import { exactDayRateFor, splitInvoiceDuties } from "./invoice-duty-rates";

const totals = { pDays: 27, phDays: 0, otDays: 0.75, otHours: 0.75, tDays: 27.75 };

describe("contract Extra Duty on invoice", () => {
  it("combined keeps one invoice with P and ED together", () => {
    const s = applyInvoiceEdMode(DEFAULT_SPLIT, "combined");
    expect(s.parts.map((p) => p.key)).toEqual(["main"]);
    expect(s.edLines).toBe(false);
    expect(totalsForPart(totals, true, s, "main").tDays).toBe(27.75);
  });

  it("separate lines keeps one invoice but prints a P Days line and an ED hours line", () => {
    const s = applyInvoiceEdMode(DEFAULT_SPLIT, "separate_lines");
    expect(s.parts).toHaveLength(1);
    expect(s.edLines).toBe(true);
    const perDuty = exactDayRateFor(26000, 26)!; // ₹1,000 per duty
    const split = splitInvoiceDuties({
      billedDays: 27.75, otDays: 0.75, regularRate: 1000, extraDutyRate: perDuty,
      shiftHours: 8, extraDutyHourly: true, exactExtraDutyRate: true,
    });
    expect(split.regularQuantity).toBe(27);
    expect(split.regularAmount).toBe(27000);
    expect(split.edQuantity).toBe(6); // 6 ED hours
    expect(split.edRate).toBe(125);
    expect(split.edAmount).toBe(750);
  });

  it("separate invoice puts P Days on the main invoice and ED on its own", () => {
    const s = applyInvoiceEdMode(DEFAULT_SPLIT, "separate_invoice");
    expect(s.parts.map((p) => p.key)).toEqual(["main", "ed"]);
    expect(totalsForPart(totals, true, s, "main").tDays).toBe(27);
    expect(totalsForPart(totals, true, s, "ed").otDays).toBe(0.75);
  });
});
