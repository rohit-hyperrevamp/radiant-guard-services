import { beforeEach, describe, expect, it, vi } from "vitest";

// Chainable fake of the supabase query builder: records every call and lets a
// per-test handler answer it (rows for a table/rpc given the recorded ops).
type Op = [string, ...unknown[]];
type Call = { kind: "from" | "rpc"; name: string; args?: unknown; ops: Op[] };
const calls: Call[] = [];
let handler: (call: Call) => unknown[] | Promise<unknown[]> = () => [];

function builder(call: Call) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq", "gte", "lte", "lt", "not", "order", "range"]) {
    b[m] = (...args: unknown[]) => { call.ops.push([m, ...args]); return b; };
  }
  b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
    calls.push(call);
    return Promise.resolve(handler(call)).then((rows) => {
      const range = call.ops.find((o) => o[0] === "range") as [string, number, number] | undefined;
      const data = range ? rows.slice(range[1], range[2] + 1) : rows;
      return { data, error: null };
    }).then(ok, bad);
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (name: string) => builder({ kind: "from", name, ops: [] }),
    rpc: (name: string, args: unknown) => builder({ kind: "rpc", name, args, ops: [] }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));

import { fetchSavedPeriods } from "./use-register-periods";
import { loadFinalInvoicesForUnits, unitPeriodKey } from "./final-invoice";
import { chunkPeriodRequests, fetchPeriodStatusesForUnitPeriods, realtimeKeyMatches, realtimeTargetOf, PERIOD_STATUS_QK } from "./period-status";
import { fetchAttendedCandidateIds } from "./period-roster";
import { hydrateFormulasFromMaster } from "./contract-hydrate";

const ids = (n: number, p = "u") => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(5, "0")}`);
const opsOf = (c: Call, m: string) => c.ops.filter((o) => o[0] === m);
const inIds = (c: Call) => (opsOf(c, "in")[0]?.[2] as string[] | undefined) ?? [];

beforeEach(() => {
  calls.length = 0;
  handler = () => [];
});

describe("useRegisterPeriods saved sheet dates", () => {
  const sheets = ids(1200).map((unit_id) => ({ unit_id, period_start: "2026-10-26", period_end: "2026-11-25" }));

  it("many sites: one month-filtered scan narrowed to the ids (same rows as id chunks)", async () => {
    handler = () => sheets;
    const want = ids(700);
    const rows = await fetchSavedPeriods(want, 2026, 10);
    expect(calls).toHaveLength(2); // 1,200 rows → two 1,000-row pages, no id chunks
    expect(calls.every((c) => opsOf(c, "in").length === 0)).toBe(true);
    expect(opsOf(calls[0], "gte")[0]).toEqual(["gte", "period_end", "2026-11-01"]);
    expect(opsOf(calls[0], "lte")[0]).toEqual(["lte", "period_end", "2026-11-30"]);
    expect(rows).toEqual(sheets.slice(0, 700));
  });

  it("few sites: id chunks with the same month filter", async () => {
    handler = (c) => sheets.filter((s) => inIds(c).includes(s.unit_id));
    const rows = await fetchSavedPeriods(ids(10), 2026, 10);
    expect(calls).toHaveLength(1);
    expect(opsOf(calls[0], "gte")[0]).toEqual(["gte", "period_end", "2026-11-01"]);
    expect(rows).toEqual(sheets.slice(0, 10));
  });
});

describe("final invoices for units", () => {
  const fi = (unit: string, end: string, part = "main") => ({
    unit_id: unit, period_start: "2026-11-01", period_end: end, part_key: part,
    final_invoices: { id: `${unit}-${end}-${part}`, invoice_no: "X" },
  });

  it("filters by the viewed period server-side, runs chunks in parallel, keys unchanged", async () => {
    let inFlight = 0;
    let peak = 0;
    handler = async (c) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return inIds(c).flatMap((u) => [fi(u, "2026-11-30"), fi(u, "2026-11-30", "p2")]);
    };
    const units = ids(1000);
    const out = await loadFinalInvoicesForUnits(units, { periodEndFrom: "2026-11-01", periodEndTo: "2026-11-30" });
    expect(calls).toHaveLength(5); // 200 ids per chunk
    expect(peak).toBeGreaterThan(1);
    expect(calls.every((c) => opsOf(c, "gte")[0]?.[2] === "2026-11-01" && opsOf(c, "lte")[0]?.[2] === "2026-11-30")).toBe(true);
    expect(out.size).toBe(2000);
    expect(out.get(unitPeriodKey(units[3], "2026-11-01", "2026-11-30"))?.id).toBe(`${units[3]}-2026-11-30-main`);
    expect(out.get(unitPeriodKey(units[3], "2026-11-01", "2026-11-30", "p2"))?.id).toBe(`${units[3]}-2026-11-30-p2`);
  });

  it("without a period reads every period (previous behaviour)", async () => {
    handler = (c) => inIds(c).map((u) => fi(u, "2026-10-31"));
    const out = await loadFinalInvoicesForUnits(["a", "b"]);
    expect(calls).toHaveLength(1);
    expect(opsOf(calls[0], "gte")).toHaveLength(0);
    expect(out.size).toBe(2);
  });
});

describe("batch_period_statuses", () => {
  const statusRow = (unit_id: string) => ({ unit_id, attendance_status: "approved", tally_invoice_path: null, run_id: "r", run_status: "approved", payroll_status: null, invoice_status: null, finalised: false });

  it("1,800 sites take 2 calls (was 4), statuses unchanged", async () => {
    handler = (c) => ((c.args as { p_periods: { unit_id: string }[] }).p_periods).map((p) => statusRow(p.unit_id));
    const periods = new Map(ids(1800).map((u) => [u, { start: "2026-11-01", end: "2026-11-30" }]));
    const out = await fetchPeriodStatusesForUnitPeriods(periods);
    expect(calls).toHaveLength(2);
    expect(out.size).toBe(1800);
    expect(out.get(ids(1800)[1799])).toEqual({ unitId: ids(1800)[1799], attendance: "approved", handedOff: true, payroll: "approved", invoice: "ready", runId: "r" });
  });

  it("a chunk that fills a page (split-invoice rows) is paged, nothing dropped", async () => {
    handler = (c) => ((c.args as { p_periods: { unit_id: string }[] }).p_periods).flatMap((p) => [statusRow(p.unit_id), { ...statusRow(p.unit_id), finalised: true }]);
    const periods = new Map(ids(900).map((u) => [u, { start: "2026-11-01", end: "2026-11-30" }]));
    const out = await fetchPeriodStatusesForUnitPeriods(periods);
    expect(calls).toHaveLength(2); // 1,800 rows → 2 pages
    expect(out.size).toBe(900);
  });

  it("chunks of 900", () => {
    expect(chunkPeriodRequests(ids(1801)).map((c) => c.length)).toEqual([900, 900, 1]);
  });
});

describe("realtime invalidation targets", () => {
  const u1 = "11111111-aaaa";
  const u2 = "22222222-bbbb";
  it("extracts unit and month; unknown payload refreshes everything", () => {
    expect(realtimeTargetOf({ new: { unit_id: u1, period_end: "2026-11-25" } })).toEqual({ unitId: u1, month: "2026-11" });
    expect(realtimeTargetOf({ new: {}, old: { id: "x" } })).toBe("all");
  });
  it("matches only keys naming the unit (and month when dated)", () => {
    const t = [{ unitId: u1, month: "2026-11" }];
    expect(realtimeKeyMatches([PERIOD_STATUS_QK, "register-all", `${u1}:2026-10-26:2026-11-25|${u2}:2026-11-01:2026-11-30`], t)).toBe(true);
    expect(realtimeKeyMatches(["attendance-saved-periods", `${u1},${u2}`, "2026-11"], t)).toBe(true);
    expect(realtimeKeyMatches(["attendance-saved-periods", `${u1},${u2}`, "2026-10"], t)).toBe(false);
    expect(realtimeKeyMatches(["finance-charter-breakdown", u2, "2026-11-01", "2026-11-30"], t)).toBe(false);
    expect(realtimeKeyMatches(["attendance-charter-shifts", u1], t)).toBe(true);
    expect(realtimeKeyMatches(["employees", u1], t)).toBe(false);
    expect(realtimeKeyMatches(["invoice-number-series", "all"], ["all"])).toBe(true);
  });
});

describe("fetchAttendedCandidateIds preloaded rows", () => {
  const answer = (c: Call) => {
    if (c.name === "attendance_entries") return [{ candidate_id: "c1" }, { candidate_id: "c2" }];
    if (c.name === "candidates") return [
      { id: "c1", unit_id: "U", is_enabled: true, status: "active" },
      { id: "c2", unit_id: "OTHER", is_enabled: true, status: "active" },
    ];
    if (c.name === "candidate_units") return [{ candidate_id: "c2" }];
    return [];
  };

  it("reuses caller entries/links and returns the same ids", async () => {
    handler = answer;
    const baseline = await fetchAttendedCandidateIds("U", "2026-11-01", "2026-11-30");
    const baseCalls = calls.map((c) => c.name);
    calls.length = 0;
    const reused = await fetchAttendedCandidateIds("U", "2026-11-01", "2026-11-30", undefined, {
      entries: Promise.resolve([{ candidate_id: "c1" }, { candidate_id: "c2" }, { candidate_id: "c1" }]),
      links: [{ candidate_id: "c2" }],
    });
    expect(reused).toEqual(baseline);
    expect(baseCalls).toContain("attendance_entries");
    expect(calls.map((c) => c.name)).not.toContain("attendance_entries");
    expect(calls.map((c) => c.name)).not.toContain("candidate_units");
  });

  it("falls back to reading when the preloaded rows failed", async () => {
    handler = answer;
    const out = await fetchAttendedCandidateIds("U", "2026-11-01", "2026-11-30", undefined, { entries: Promise.reject(new Error("x")) });
    expect(calls.map((c) => c.name)).toContain("attendance_entries");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("hydrateFormulasFromMaster", () => {
  it("reads both master tables in parallel; allowance then cost precedence kept", async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    handler = async (c) => {
      started.push(c.name);
      if (started.length === 2) release();
      await gate;
      return c.name === "allowance_types"
        ? [{ id: "a1", formula_mode: "advanced", formula_expression: "basic*2", formula_version: 3 }]
        : [{ id: "k1", formula_mode: "advanced", formula_expression: "basic*0.12", formula_version: 1 }];
    };
    const [r] = await hydrateFormulasFromMaster([{
      components: [{ name: "HRA", amount: 0, allowanceId: "a1" }],
      deductions: [{ name: "PF", amount: 0, costComponentId: "k1" }],
    }]);
    expect(started.sort()).toEqual(["allowance_types", "cost_components"]);
    expect((r.components[0] as { formulaExpression?: string }).formulaExpression).toBe("basic*2");
    expect((r.deductions![0] as { formulaExpression?: string }).formulaExpression).toBe("basic*0.12");
  });
});
