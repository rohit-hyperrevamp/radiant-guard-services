import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // The identity watch only runs in a browser.
  if (typeof window === "undefined") (globalThis as { window?: unknown }).window = globalThis;
  return {
  owner: "user-a" as string | null,
  listeners: [] as Array<(event: string, session: { user: { id: string } } | null) => void>,
  fromCalls: 0,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) b[m] = () => b;
    b.range = () => Promise.resolve({ data: [], error: null });
    return b;
  };
  return {
    supabase: {
      from: () => {
        mocks.fromCalls++;
        return builder();
      },
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: mocks.owner ? { user: { id: mocks.owner } } : null },
          }),
        onAuthStateChange: (fn: (typeof mocks.listeners)[number]) => {
          mocks.listeners.push(fn);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
  };
});

import {
  invalidateDashboardBase,
  istAddDays,
  istDate,
  istMonthRange,
  loadDashboardBase,
  pickSelfEmployee,
  summarizeMyAttendance,
} from "./dashboard-base";

describe("India-time dates", () => {
  it("uses the India calendar day before 05:30 IST (UTC is still yesterday)", () => {
    // 2026-11-30 20:00 UTC = 2026-12-01 01:30 IST
    expect(istDate(new Date("2026-11-30T20:00:00Z"))).toBe("2026-12-01");
    expect(istDate(new Date("2026-11-30T18:00:00Z"))).toBe("2026-11-30");
  });

  it("adds days across month and year ends without drift", () => {
    expect(istAddDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(istAddDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(istAddDays("2026-11-25", 60)).toBe("2027-01-24");
  });

  it("builds the India month range (no previous-day month start)", () => {
    expect(istMonthRange(new Date("2026-11-30T20:00:00Z"))).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
    expect(istMonthRange(new Date("2028-02-10T06:00:00Z"))).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });
});

describe("pickSelfEmployee (rehired staff share a mobile)", () => {
  it("returns null for no rows and the row itself for one", () => {
    expect(pickSelfEmployee([])).toBeNull();
    expect(pickSelfEmployee(null)).toBeNull();
    expect(pickSelfEmployee([{ id: "a" }])?.id).toBe("a");
  });

  it("prefers the enabled, then live, then most recent row", () => {
    const rows = [
      { id: "old", status: "active", is_enabled: true, approved_at: "2024-01-01" },
      { id: "new", status: "active", is_enabled: true, approved_at: "2026-10-01" },
      { id: "off", status: "active", is_enabled: false, approved_at: "2026-11-01" },
      { id: "draft", status: "pending", is_enabled: true, approved_at: "2026-11-20" },
    ];
    expect(pickSelfEmployee(rows)?.id).toBe("new");
  });
});

describe("summarizeMyAttendance", () => {
  const codes = [
    { code: "P", counts_as_present: true, is_leave: false, is_paid: true, day_value: 1 },
    { code: "L", counts_as_present: true, is_leave: false, is_paid: true, day_value: 1 },
    { code: "A", counts_as_present: false, is_leave: false, is_paid: false },
    { code: "WO", counts_as_present: false, is_leave: false, is_paid: true },
    { code: "PH", counts_as_present: false, is_leave: false, is_paid: true },
    { code: "CL", counts_as_present: false, is_leave: true, is_paid: true },
  ];

  it("counts present from the code master: WO/PH are not present, Late is", () => {
    const rows = [
      { code: "P", ot_hours: 0 },
      { code: "L", ot_hours: 0 },
      { code: "WO", ot_hours: 0 },
      { code: "PH", ot_hours: 0 },
      { code: "A", ot_hours: 0 },
      { code: "CL", ot_hours: 0 },
      { code: "p", ot_hours: 0.5 },
    ];
    expect(summarizeMyAttendance(rows, codes)).toEqual({
      present: 3,
      absent: 1,
      leave: 1,
      edDays: 0.5,
      total: 7,
    });
  });

  it("keeps Extra Duty days exact to 4 decimals", () => {
    const rows = [
      { code: "P", ot_hours: 7.1875 },
      { code: "P", ot_hours: "0.25" },
    ];
    expect(summarizeMyAttendance(rows, codes).edDays).toBe(7.4375);
  });

  it("falls back to P/A only when the code master is unavailable", () => {
    const rows = [
      { code: "P", ot_hours: null },
      { code: "WO", ot_hours: null },
      { code: "A", ot_hours: null },
    ];
    expect(summarizeMyAttendance(rows, undefined)).toMatchObject({ present: 1, absent: 1 });
  });
});

describe("dashboard base cache is per user", () => {
  beforeEach(() => {
    invalidateDashboardBase();
    mocks.fromCalls = 0;
    mocks.owner = "user-a";
  });

  it("reuses the cache for the same user but reloads for another user", async () => {
    await loadDashboardBase();
    const afterFirst = mocks.fromCalls;
    expect(afterFirst).toBeGreaterThan(0);
    await loadDashboardBase();
    expect(mocks.fromCalls).toBe(afterFirst);
    mocks.owner = "user-b";
    await loadDashboardBase();
    expect(mocks.fromCalls).toBe(afterFirst * 2);
  });

  it("drops the cache on sign-out", async () => {
    await loadDashboardBase();
    const afterFirst = mocks.fromCalls;
    for (const fn of mocks.listeners) fn("SIGNED_OUT", null);
    await loadDashboardBase();
    expect(mocks.fromCalls).toBe(afterFirst * 2);
  });
});

describe("summarizeMyAttendance absences (review round 2)", () => {
  it("counts A as absent when its master row has is_paid unset, never paid offs", async () => {
    const { summarizeMyAttendance } = await import("./dashboard-base");
    const codes = [
      { code: "A", counts_as_present: false, is_leave: false, is_paid: null, day_value: 0 },
      { code: "WO", counts_as_present: false, is_leave: false, is_paid: true, day_value: 0 },
      { code: "P", counts_as_present: true, is_leave: false, is_paid: true, day_value: 1 },
    ];
    const rows = ["A", "A", "WO", "P"].map((code) => ({ code, ot_hours: 0 }));
    const s = summarizeMyAttendance(rows, codes as never);
    expect(s.absent).toBe(2);
    expect(s.present).toBe(1);
  });
});
