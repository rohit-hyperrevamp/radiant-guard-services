import { describe, expect, it } from "vitest";
import { hasEmployeeOffboarding } from "./employee-workspace";

describe("employee offboarding document visibility", () => {
  it("hides exit documents for an active employee without an exit", () => {
    expect(hasEmployeeOffboarding({ status: "active" })).toBe(false);
  });
  it("shows exit documents once offboarding collection is pending", () => {
    expect(hasEmployeeOffboarding({ status: "active", offboarding_details: { collection_status: "pending" } })).toBe(true);
  });
  it("shows exit documents for an offboarded inactive employee", () => {
    expect(hasEmployeeOffboarding({ status: "inactive", offboarded_at: "2026-11-16" })).toBe(true);
  });
  it("does not treat an old exit as a new exit after rehire", () => {
    expect(hasEmployeeOffboarding({ status: "active", offboarded_at: "2025-01-01", offboarding_details: { collection_status: "completed" } })).toBe(false);
  });
  it("does not equate an inactive status alone with offboarding", () => {
    expect(hasEmployeeOffboarding({ status: "inactive" })).toBe(false);
  });
});