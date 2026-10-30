import { describe, expect, it } from "vitest";
import { applyCtcPass, isMgmtFeeLine, isRelieverLine } from "./contract-billing-addons";

// CLI2627 Security Guard: Total CTC ₹21,223.17, Reliever 16.67% of CTC,
// Management Fee 10% of (CTC + Reliever). Saved amount must equal the
// editor's figure so the billing total stays ₹27,237.18 after saving.
describe("CLI2627 management fee on save", () => {
  const ctc = 21223.17;
  type L = { name: string; amount: number };
  const compute = (b: L, base: L[]) => {
    const reliever = base.filter((x) => isRelieverLine(x) && !isMgmtFeeLine(x)).reduce((s, r) => s + r.amount, 0);
    const v = !/management/i.test(b.name) ? ctc * 0.1667 : (ctc + reliever) * 0.1;
    return Math.round(v * 100) / 100;
  };
  const list: L[] = [
    { name: "Management Fee 10% (CTC + Reliever)", amount: 0 },
    { name: "Reliever Charges 16.67% (Total CTC)", amount: 0 },
  ];

  it("stores management fee including the reliever", () => {
    const out = applyCtcPass(list, [], compute, () => true);
    const fee = out.find((l) => /management/i.test(l.name))!.amount;
    const rel = out.find((l) => /^reliever/i.test(l.name))!.amount;
    expect(rel).toBe(3537.9);
    expect(fee).toBe(2476.11);
    expect(Math.round((ctc + rel + fee) * 100) / 100).toBe(27237.18);
  });
});
