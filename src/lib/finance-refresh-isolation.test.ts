import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/finance-summary-compute", () => ({ computeFinanceSummaries: vi.fn() }));
import { computeGroupIsolated } from "./finance-refresh.server";

const row = (unit_id: string) =>
  ({ unit_id, period_start: "2026-10-01", period_end: "2026-10-31", generation: 1, lease_token: "t" }) as never;

describe("finance refresh isolates failing sites", () => {
  it("one broken site no longer fails the whole batch", async () => {
    const compute = vi.fn(async (periods: Map<string, unknown>) => {
      if (periods.has("bad")) throw new Error("boom");
      return new Map([...periods.keys()].map((k) => [k, { invoice_amount: 1 }]));
    });
    const errors: Array<string | null> = [];
    const { ok, failed } = await computeGroupIsolated([row("a"), row("bad"), row("c")], compute, (u) => errors.push(u));
    expect(ok.map((o) => o.row.unit_id)).toEqual(["a", "c"]);
    expect(failed.map((f) => f.unit_id)).toEqual(["bad"]);
    expect(errors).toEqual([null, "bad"]);
  });

  it("uses a single call when the batch succeeds", async () => {
    const compute = vi.fn(async (periods: Map<string, unknown>) => new Map([...periods.keys()].map((k) => [k, {}])));
    const { ok, failed } = await computeGroupIsolated([row("a"), row("b")], compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(ok).toHaveLength(2);
    expect(failed).toHaveLength(0);
  });

  it("marks sites with no result as failed without throwing", async () => {
    const compute = vi.fn(async () => new Map([["a", {}]]));
    const { ok, failed } = await computeGroupIsolated([row("a"), row("nocontract")], compute);
    expect(ok).toHaveLength(1);
    expect(failed.map((f) => f.unit_id)).toEqual(["nocontract"]);
  });
});
