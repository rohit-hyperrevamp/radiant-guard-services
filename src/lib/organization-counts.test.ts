import { describe, expect, it } from "vitest";
import { organizationCounts } from "./organization-counts";

const records = [
  ...Array.from({ length: 361 }, () => ({ status: "active" })),
  ...Array.from({ length: 21 }, () => ({ status: "inactive" })),
];

describe("Organization status totals", () => {
  it("defaults to the same 361 active organizations shown on the dashboard", () => {
    expect(organizationCounts(records)).toEqual({ total: 361, active: 361, inactive: 21 });
  });
  it("shows inactive records only in the inactive total", () => {
    expect(organizationCounts(records, "inactive").total).toBe(21);
  });
  it("includes all 382 records only when all statuses is selected", () => {
    expect(organizationCounts(records, "all").total).toBe(382);
  });
});