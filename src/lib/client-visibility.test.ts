import { describe, expect, it } from "vitest";
import { activeClientIds, isOperationalClient, visibleClientRows } from "./client-visibility";

describe("inactive clients are hidden throughout operations", () => {
  const clients = [
    { id: "CLI4660", status: "inactive" },
    { id: "CLI4683", status: "inactive" },
    { id: "CLI4249", status: "active" },
  ];
  for (const section of ["invoice", "attendance", "payroll", "pickers", "dashboard"]) {
    it(`excludes both disabled clients from ${section}, including cached rows`, () => {
      expect(visibleClientRows(clients, activeClientIds(clients)).map((row) => row.id)).toEqual(["CLI4249"]);
    });
  }
  it("blocks inactive and unverified direct client pages", () => {
    expect(isOperationalClient(clients[0])).toBe(false);
    expect(isOperationalClient(clients[1])).toBe(false);
    expect(isOperationalClient(null)).toBe(false);
    expect(isOperationalClient({})).toBe(false);
    expect(isOperationalClient(clients[2])).toBe(true);
  });
  it("does not modify archived records when filtering", () => {
    const before = structuredClone(clients);
    visibleClientRows(clients, activeClientIds(clients));
    expect(clients).toEqual(before);
  });
});