import { describe, it, expect, vi } from "vitest";
const fixtures = vi.hoisted(() => ({
  deds: [] as any[],
  contribs: [] as any[],
  runs: [] as any[],
  failAt: -1,
}));
vi.mock("@/lib/supabase-ready", () => ({ supabaseSessionReady: async () => true }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let start = 0,
        end = 999;
      const q: any = {
        select: () => q,
        gte: () => q,
        lte: () => q,
        order: () => q,
        in: () => q,
        range: (a: number, b: number) => {
          start = a;
          end = b;
          return q;
        },
        then: (resolve: any) =>
          resolve({
            data: (table === "deductions"
              ? fixtures.deds
              : table === "employer_contributions"
                ? fixtures.contribs
                : fixtures.runs
            ).slice(start, end + 1),
            error:
              table === "deductions" && start === fixtures.failAt
                ? { message: "Page failed" }
                : null,
          }),
      };
      return q;
    },
  },
}));
import { complianceMonthQuery } from "./compliance-month";
import { ledgerAmount, statutoryHead } from "./statutory-heads";
describe("complete compliance ledger", () => {
  it("loads statutory records beyond first page and reconciles both shares", async () => {
    fixtures.deds = Array.from({ length: 2001 }, (_, i) => ({
      id: String(i),
      candidate_id: "employee",
      unit_id: "site",
      status: i === 2000 ? "completed" : "cancelled",
      deduction_name: "PT",
      amount: 200,
    }));
    fixtures.contribs = [
      {
        id: "er",
        candidate_id: "employee",
        unit_id: "site",
        status: "processed",
        contribution_name: "PT",
        amount: 50,
      },
    ];
    const ledger = await complianceMonthQuery("2026-09").queryFn();
    expect(ledger.deds).toHaveLength(1);
    expect([...ledger.deds, ...ledger.contribs].reduce((s, r) => s + ledgerAmount(r), 0)).toBe(250);
    expect(statutoryHead(ledger.deds[0].deduction_name)).toBe("pt");
  });
  it("rejects incomplete ledgers instead of reporting a successful zero", async () => {
    fixtures.failAt = 1000;
    await expect(complianceMonthQuery("2026-09").queryFn()).rejects.toMatchObject({
      message: "Page failed",
    });
    fixtures.failAt = -1;
  });
});
