import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/native", () => ({ isNativePlatform: () => false, logNativeEvent: () => {} }));
import { istDateOf, pickActivePunch, previousIsoDate } from "./self-attendance";

const punch = (punch_date: string, check_in_at: string | null, check_out_at: string | null = null) => ({
  punch_date,
  check_in_at,
  check_out_at,
});

describe("self attendance IST dates", () => {
  it("uses the IST date, not UTC, just after midnight IST", () => {
    // 00:30 IST on 26 Nov = 19:00 UTC on 25 Nov
    expect(istDateOf(new Date("2026-11-25T19:00:00Z"))).toBe("2026-11-26");
    expect(istDateOf(new Date("2026-11-25T18:29:00Z"))).toBe("2026-11-25");
  });

  it("steps back across month ends", () => {
    expect(previousIsoDate("2026-12-01")).toBe("2026-11-30");
    expect(previousIsoDate("2027-01-01")).toBe("2026-12-31");
  });
});

describe("pickActivePunch (night shift)", () => {
  const now = new Date("2026-11-26T01:30:00Z"); // 07:00 IST on 26 Nov

  it("returns yesterday's open punch so the guard can check out after midnight", () => {
    const open = punch("2026-11-25", "2026-11-25T14:30:00Z"); // 20:00 IST
    expect(pickActivePunch([open], now)).toBe(open);
  });

  it("prefers today's punch when one exists", () => {
    const todays = punch("2026-11-26", "2026-11-26T01:00:00Z");
    const open = punch("2026-11-25", "2026-11-25T14:30:00Z");
    expect(pickActivePunch([open, todays], now)).toBe(todays);
  });

  it("ignores yesterday's punch once it is checked out", () => {
    expect(pickActivePunch([punch("2026-11-25", "2026-11-25T14:30:00Z", "2026-11-26T00:30:00Z")], now)).toBeNull();
  });

  it("ignores a forgotten open punch older than the maximum shift", () => {
    expect(pickActivePunch([punch("2026-11-25", "2026-11-25T03:00:00Z")], now)).toBeNull();
  });
});
