import { describe, expect, it } from "vitest";
import { billingRatePerDay, misBillingLine, periodDateList } from "./mis-billing";

const bases = {
  billingDayBase: { method: "fixed_days" as const, fixedDays: 27 },
  payrollDayBase: { method: "actual_minus_days" as const, fixedDays: 4 },
};
const monthly = 21753.58;

describe("CLI4096 fixed 27-day billing divisor", () => {
  it("keeps the same daily rate when the payroll period allows 26 or 27 days", () => {
    const september = periodDateList("2026-09-01", "2026-09-30");
    const october = periodDateList("2026-10-01", "2026-10-31");
    expect(billingRatePerDay(monthly, bases, september)).toBe(805.69);
    expect(billingRatePerDay(monthly, bases, october)).toBe(805.69);
  });

  it.each([{ duties: 26, amount: 20947.94 }, { duties: 27, amount: 21753.63 }])(
    "bills $duties duties at the fixed daily rate",
    ({ duties, amount }) => {
      const perDay = billingRatePerDay(monthly, bases, periodDateList("2026-09-01", "2026-09-30"));
      const line = misBillingLine({ perDay, billedDays: duties, otDays: 0, total: perDay * duties, intraState: true });
      expect(line.totalBilling).toBe(amount);
    },
  );
});