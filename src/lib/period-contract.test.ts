import { describe, expect, it } from "vitest";
import { fetchPeriodContract } from "./period-contract";

// Minimal query-builder double: records the order() calls and returns the
// rows sorted the way PostgREST would for those calls.
function fakeClient(rows: Record<string, unknown>[]) {
  const orders: { col: string; asc: boolean }[] = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    lte: () => builder,
    or: () => builder,
    order: (col: string, opts: { ascending: boolean }) => {
      orders.push({ col, asc: opts.ascending });
      return builder;
    },
    limit: (n: number) => {
      const sorted = [...rows].sort((a, b) => {
        for (const o of orders) {
          const av = String(a[o.col] ?? "");
          const bv = String(b[o.col] ?? "");
          if (av !== bv) return (av < bv ? -1 : 1) * (o.asc ? 1 : -1);
        }
        return 0;
      });
      return Promise.resolve({ data: sorted.slice(0, n) });
    },
  };
  return { from: () => builder } as never;
}

describe("contract used for a payroll/invoice period", () => {
  // CLI1382 (ICICI Ponda): an expired copy and the live contract both start 1 Apr 2026.
  const tied = [
    { id: "expired-copy", status: "expired", start_date: "2026-04-01", created_at: "2026-10-10T20:44:12Z" },
    { id: "live", status: "active", start_date: "2026-04-01", created_at: "2026-10-08T20:52:33Z" },
  ];

  it("picks the active contract when two contracts share a start date", async () => {
    const c = await fetchPeriodContract<{ id: string }>("u", "2026-09-01", "2026-09-30", "id", fakeClient(tied));
    expect(c?.id).toBe("live");
  });

  it("gives the same answer whatever order the rows come back in", async () => {
    const c = await fetchPeriodContract<{ id: string }>("u", "2026-09-01", "2026-09-30", "id", fakeClient([...tied].reverse()));
    expect(c?.id).toBe("live");
  });

  it("still prefers the later start date over status", async () => {
    const rows = [
      { id: "old-active", status: "active", start_date: "2025-04-01", created_at: "2025-04-01T00:00:00Z" },
      { id: "new-expired", status: "expired", start_date: "2026-04-01", created_at: "2026-04-01T00:00:00Z" },
    ];
    const c = await fetchPeriodContract<{ id: string }>("u", "2026-09-01", "2026-09-30", "id", fakeClient(rows));
    expect(c?.id).toBe("new-expired");
  });
});
