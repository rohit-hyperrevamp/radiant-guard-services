import { CheckCircle2, Clock, Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, MoneyStatus } from "@/lib/period-status";

const base =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]";

export function AttendanceStatusBadge({
  status,
  className,
  filled,
}: {
  status: AttendanceStatus;
  className?: string;
  /** When known: whether any attendance is marked yet. Shows a red (not filled) or green (in progress) dot. */
  filled?: boolean;
}) {
  if (filled !== undefined && status !== "approved") {
    const cfg =
      status === "submitted"
        ? { label: "Submitted", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600", dot: "bg-emerald-500" }
        : filled
          ? { label: "In progress", tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600", dot: "bg-emerald-500 animate-pulse" }
          : { label: "Not filled", tone: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" };
    return (
      <span className={cn(base, cfg.tone, className)}>
        <span className={cn("h-2 w-2 rounded-full", cfg.dot)} /> {cfg.label}
      </span>
    );
  }
  const map: Record<AttendanceStatus, { label: string; tone: string; icon: typeof Clock }> = {
    none: { label: "Attendance open", tone: "border-border bg-muted text-muted-foreground", icon: LockOpen },
    draft: { label: "Attendance open", tone: "border-border bg-muted text-muted-foreground", icon: LockOpen },
    submitted: {
      label: "Attendance open",
      tone: "border-border bg-muted text-muted-foreground",
      icon: LockOpen,
    },
    approved: {
      label: "Attendance approved",
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
      icon: Lock,
    },
    rejected: {
      label: "Attendance open",
      tone: "border-border bg-muted text-muted-foreground",
      icon: LockOpen,
    },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <span className={cn(base, cfg.tone, className)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

export function MoneyStatusBadge({
  kind,
  status,
  className,
}: {
  kind: "payroll" | "invoice";
  status: MoneyStatus;
  className?: string;
}) {
  const label = kind === "payroll" ? "Payroll" : "Invoice";
  const map: Record<MoneyStatus, { text: string; tone: string; icon: typeof Clock }> = {
    open: {
      text: `${label} open`,
      tone: "border-destructive/25 bg-destructive/10 text-destructive",
      icon: LockOpen,
    },
    ready: {
      text: `${label} ready`,
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-600",
      icon: Clock,
    },
    approved: {
      text: `${label} approved`,
      tone: "border-sky-500/30 bg-sky-500/10 text-sky-600",
      icon: CheckCircle2,
    },
    processed: {
      text: `${label} processed`,
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
      icon: CheckCircle2,
    },
  };
  const cfg = map[status];
  const visibleCfg = cfg;
  const Icon = visibleCfg.icon;
  return (
    <span className={cn(base, visibleCfg.tone, className)}>
      <Icon className="h-3 w-3" /> {visibleCfg.text}
    </span>
  );
}
