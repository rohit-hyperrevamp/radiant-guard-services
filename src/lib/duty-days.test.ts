import { describe, expect, it } from "vitest";
import { roundDutyDays } from "./duty-days";
import { computeTotals } from "./payroll-calc";

describe("Extra Duty days are not rounded to 2 decimals", () => {
  it("57.5 Extra Duty hours on an 8-hour shift stay 7.1875 days", () => {
    expect(roundDutyDays(57.5 / 8)).toBe(7.1875);
  });
});
