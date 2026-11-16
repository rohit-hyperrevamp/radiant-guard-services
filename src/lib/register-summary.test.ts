import { describe, expect, it } from "vitest";
import { dashboardRegisterSearch, matchesAttendanceStatus, summarizeRegisterStatuses } from "./register-summary";
import { currentActiveContract } from "./dashboard-master-counts";
import type { PeriodStatus } from "./period-status";

const row = (id: string, attendance: PeriodStatus["attendance"], payroll: PeriodStatus["payroll"] = "open", invoice: PeriodStatus["invoice"] = "open"): PeriodStatus => ({ unitId: id, attendance, payroll, invoice, runId: null, handedOff: false });

describe("Dashboard/register agreement", () => {
  it("does not count an expired saved-active contract as currently active", () => {
    expect(currentActiveContract({ status: "active", end_date: "2026-08-31" }, "2026-11-16")).toBe(false);
    expect(currentActiveContract({ status: "active", end_date: "2026-12-31" }, "2026-11-16")).toBe(true);
  });
  it("carries September 2026 and all windows into the clicked register", () => {
    expect(dashboardRegisterSearch(8, 2026, "all")).toEqual({ month: 8, year: 2026, window: "all", status: "all", dashboard: true });
  });
  it("counts approved sites once and only within the visible site roster", () => {
    const rows = new Map([row("a", "approved"), row("hidden", "approved")].map(s => [s.unitId, s]));
    expect(summarizeRegisterStatuses(["a", "a"], rows).attendance.approved).toBe(1);
  });
  it("open means none, draft and rejected both in the count and filter", () => {
    const statuses = [row("a", "none"), row("b", "draft"), row("c", "rejected"), row("d", "submitted"), row("e", "approved")];
    const summary = summarizeRegisterStatuses(statuses.map(s => s.unitId), new Map(statuses.map(s => [s.unitId, s])));
    expect(summary.attendance).toEqual({ approved: 1, submitted: 1, open: 3, inProgress: 2 });
    expect(statuses.filter(s => matchesAttendanceStatus(s, "open")).length).toBe(3);
  });
  it("uses processed/ready/approved statuses shared with payroll and invoice pages", () => {
    const statuses = [row("a", "approved", "approved", "processed"), row("b", "approved", "processed", "ready"), row("c", "none")];
    const result = summarizeRegisterStatuses(statuses.map(s => s.unitId), new Map(statuses.map(s => [s.unitId, s])));
    expect(result.payroll).toEqual({ approved: 1, ready: 0, processed: 1, open: 1 });
    expect(result.invoice).toEqual({ approved: 0, ready: 1, processed: 1, open: 1 });
  });
  it("does not invent open counts from unloaded status data", () => {
    expect(summarizeRegisterStatuses(["missing"], new Map()).attendance.open).toBe(0);
    expect(matchesAttendanceStatus(undefined, "open")).toBe(false);
  });
});