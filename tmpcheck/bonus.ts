import { computeWages } from "../src/lib/payroll-calc";
const resource: any = {
  designationId: "d1",
  components: [
    { name: "Basic", amount: 12795.12 },
    { name: "DA", amount: 2511.08 },
    { name: "Bonus / Exgratia 8.33% (Rs.7000)", amount: 583, fixedCalcMethod: "per_duty", fixedDutyDivisor: "fixed_26", fixedDutyComponents: ["p_days"] },
  ],
  benefits: [], deductions: [], employerContributions: [], payrollDayBase: null,
};
const totals: any = { pDays: 20, otDays: 0, phDays: 0, otherPaidDays: 0, otHours: 0 };
const w = computeWages(totals, resource, 30, { dayBases: [] });
console.log(w.components.map((c: any) => `${c.name}: ${c.amount}`).join("\n"));
