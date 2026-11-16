import type { PeriodStatus } from "@/lib/period-status";

export function summarizeRegisterStatuses(ids: string[], statuses: Map<string, PeriodStatus>) {
  const attendance = { approved: 0, submitted: 0, inProgress: 0, open: 0 };
  const payroll = { approved: 0, ready: 0, processed: 0, open: 0 };
  const invoice = { approved: 0, ready: 0, processed: 0, open: 0 };
  for (const id of new Set(ids)) {
    const status = statuses.get(id);
    // Missing responses are not evidence of an open sheet.
    if (!status) continue;
    if (status.attendance === "approved") attendance.approved++;
    else if (status.attendance === "submitted") attendance.submitted++;
    else {
      attendance.open++;
      if (status.attendance === "draft" || status.attendance === "rejected") attendance.inProgress++;
    }
    payroll[status.payroll]++;
    invoice[status.invoice]++;
  }
  return { attendance, payroll, invoice };
}

export function matchesAttendanceStatus(status: PeriodStatus | undefined, filter: string) {
  if (filter === "all") return true;
  if (!status) return false;
  if (filter === "open") return !["approved", "submitted"].includes(status.attendance);
  if (filter === "in_progress") return status.attendance === "draft" || status.attendance === "rejected";
  return status.attendance === filter;
}

export function dashboardRegisterSearch(month: number, year: number, window: string, status = "all") {
  return { month, year, window, status, dashboard: true };
}