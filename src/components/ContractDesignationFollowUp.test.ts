import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { followUpOverdueCutoff, withAge } from "./ContractDesignationFollowUp";

const row = (missing_since: string) => ({
  candidate_id: "c", full_name: "n", employee_code: null, candidate_code: null, unit_id: "u",
  unit_name: "U", unit_code: "U1", customer_name: "C", designation_id: "d", designation_name: "D",
  contract_id: null, missing_since,
});

describe("contract designation follow-up helpers", () => {
  it("cutoff matches the client-side overdue rule (days >= 7)", () => {
    const now = new Date(2026, 10, 25, 15, 30);
    const cutoff = followUpOverdueCutoff(now);
    expect(cutoff).toBe("2026-11-18");
    expect(withAge(row(cutoff), now).days).toBe(7);
    expect(withAge(row("2026-11-19"), now).days).toBe(6);
  });

  it("handles month boundaries", () => {
    expect(followUpOverdueCutoff(new Date(2026, 2, 3, 9))).toBe("2026-02-24");
  });
});
