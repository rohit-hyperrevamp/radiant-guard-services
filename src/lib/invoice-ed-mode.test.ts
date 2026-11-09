import { describe, expect, it } from "vitest";
import { applyInvoiceEdMode, DEFAULT_SPLIT, invoiceEdModeForSave, normalizeInvoiceEdMode, totalsForPart, type InvoiceEdMode, type InvoiceSplit } from "./invoice-split";
import { exactDayRateFor, invoiceDutyBillingLines, splitInvoiceDuties } from "./invoice-duty-rates";

const totals = { pDays: 27, phDays: 0, otDays: 0.75, otHours: 0.75, tDays: 27.75 };

describe("contract Extra Duty on invoice", () => {
  it("CLI4349 overrides L&T Main / OT+Reliever tabs with one combined invoice", () => {
    const s = applyInvoiceEdMode({
      parts: [{ key: "main", label: "Main invoice" }, { key: "part2", label: "OT+Reliever" }],
      assign: { regular: "main", ph: "main", ed: "part2", reliever: "part2", extras: "main" },
    }, "combined");
    expect(s.parts.map((part) => part.key)).toEqual(["main"]);
    expect(s.edLines).toBe(false);
    expect(s.assign.ed).toBe("main");
    expect(s.assign.reliever).toBe("main");
  });

  const companySplit: InvoiceSplit = {
    parts: [{ key: "main", label: "Present" }, { key: "ed", label: "Extra Duty" }],
    assign: { regular: "main", ph: "main", ed: "ed", reliever: "ed", extras: "main" },
  };

  it.each<InvoiceEdMode>(["combined", "separate_lines", "separate_invoice"])("persists and reads back the explicit %s selection", (mode) => {
    expect(normalizeInvoiceEdMode(invoiceEdModeForSave(mode))).toBe(mode);
  });

  it("combined overrides a saved split including excluded Extra Duty", () => {
    const s = applyInvoiceEdMode({ ...companySplit, assign: { ...companySplit.assign, ed: "exclude" } }, "combined");
    expect(s.assign.ed).toBe("main");
    expect(s.assign.reliever).toBe("main");
    expect(s.parts.map((p) => p.key)).toEqual(["main"]);
    expect(totalsForPart(totals, true, s, "main").tDays).toBe(27.75);
  });

  it("separate rows overrides old separate tabs without dropping reliever Extra Duty", () => {
    const s = applyInvoiceEdMode(companySplit, "separate_lines");
    expect(s.parts.map((p) => p.key)).toEqual(["main"]);
    expect(s.edLines).toBe(true);
    expect(totalsForPart({ ...totals, pDays: 0, otDays: 2, tDays: 2 }, false, s, "main").tDays).toBe(2);
  });

  it("separate invoice routes regular and reliever Extra Duty only to the Extra Duty tab", () => {
    const s = applyInvoiceEdMode(DEFAULT_SPLIT, "separate_invoice");
    const reliever = { pDays: 0, phDays: 0, otDays: 2, otHours: 2, tDays: 2 };
    expect(totalsForPart(reliever, false, s, "main").tDays).toBe(0);
    expect(totalsForPart(reliever, false, s, "ed").tDays).toBe(2);
  });

  it("combined renders one duty total while preserving distinct agreed ED pricing", () => {
    const dutySplit = splitInvoiceDuties({ billedDays: 29, otDays: 2, regularRate: 1000, extraDutyRate: 1500 });
    const lines = invoiceDutyBillingLines({ dutySplit, edLines: false, unitRate: 1000, unitQuantity: 29, actual: dutySplit.actual, unitLabel: "Duty", extraDutyUnitLabel: "Duty" });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(29);
    expect(lines[0].amount).toBe(30000);
    expect(lines[0].rate * lines[0].quantity).toBeCloseTo(30000, 8);
  });

  it("separate rows emits P and Extra Duty on one invoice with unchanged amounts", () => {
    const dutySplit = splitInvoiceDuties({ billedDays: 29, otDays: 2, regularRate: 1000, extraDutyRate: 1500 });
    const lines = invoiceDutyBillingLines({ dutySplit, edLines: true, unitRate: 1000, unitQuantity: 29, actual: dutySplit.actual, unitLabel: "Duty", extraDutyUnitLabel: "Duty" });
    expect(lines.map((line) => line.quantity)).toEqual([27, 2]);
    expect(lines.map((line) => line.amount)).toEqual([27000, 3000]);
  });

  it("CLI3246 combines Present and Extra Duty day equivalents without an hourly rate", () => {
    const s = applyInvoiceEdMode(DEFAULT_SPLIT, "combined");
    const attendance = { pDays: 26, phDays: 0, otDays: 7.1875, otHours: 7.1875, tDays: 33.1875 };
    const billed = totalsForPart(attendance, true, s, "main");
    expect(billed.pDays).toBe(26);
    expect(billed.otDays).toBe(7.1875);
    expect(billed.tDays).toBe(33.1875);
    expect(s.edLines).toBe(false);
    expect(s.assign.ed).toBe(s.assign.regular);
  });

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
    const perDuty = exactDayRateFor(26000, 26); // ₹1,000 per duty
    if (perDuty == null) throw new Error("Expected a valid daily rate");
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
