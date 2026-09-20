import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCENT_CHIP,
  ACCENT_TILE_BG,
  accentFromKey,
  accentFromTone,
  type Accent,
} from "@/components/tile-theme";

export type Crumb = { label: string; to?: string };

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  eyebrow,
  kpis,
  className,
}: {
  title: string;
  description?: string;
  /** Kept for call-site compatibility; breadcrumb navigation is intentionally hidden. */
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  /** Optional KPI/stat row rendered below the title inside the hero */
  kpis?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mb-3 sm:mb-5", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-3 sm:p-5">
        <div className="relative flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <div className="mt-0.5 shrink-0">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20 sm:h-11 sm:w-11">
                  <Icon className="h-4.5 w-4.5 sm:h-[19px] sm:w-[19px]" />
                </div>
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                  {eyebrow}
                </div>
              )}
              <h1 className="font-display text-[18px] font-semibold leading-tight text-foreground sm:truncate sm:text-[24px]">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-2xl text-[13px] leading-snug text-muted-foreground sm:text-[14px]">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex w-full flex-wrap items-center gap-2 self-start [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[calc(50%-0.3rem)] sm:w-auto sm:justify-end sm:[&>*]:w-auto sm:[&>*]:flex-none sm:[&>*]:basis-auto">
              {actions}
            </div>
          )}
        </div>

        {kpis && (
          <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact stat pill used inside <PageHeader kpis={...}>.
 */
export function PageStat({
  label,
  value,
  tone = "default",
  icon: Icon,
  trend,
  onClick,
  active,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "destructive";
  icon?: LucideIcon;
  trend?: { delta: string; direction?: "up" | "down" | "flat" };
  onClick?: () => void;
  active?: boolean;
  sub?: string;
  accent?: Accent;
}) {
  const resolvedAccent: Accent = accent ?? accentFromTone(tone) ?? accentFromKey(label);
  const trendCls =
    trend?.direction === "down"
      ? "text-rose-700 bg-rose-500/15 ring-rose-500/25"
      : trend?.direction === "flat"
        ? "text-muted-foreground bg-card/70 ring-border"
        : "text-emerald-700 bg-emerald-500/15 ring-emerald-500/25";
  const Wrapper: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border/40 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-[26px] sm:p-4.5",
        ACCENT_TILE_BG[resolvedAccent],
        onClick && "cursor-pointer",
        active && "ring-2 ring-accent/40",
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-[13px] font-semibold leading-tight text-foreground sm:text-[15px]">
            {label}
          </div>
          {sub && <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground sm:text-[11.5px]">{sub}</div>}
        </div>
        {trend && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset tabular-nums",
              trendCls,
            )}
          >
            {trend.delta}
          </span>
        )}
      </div>
      <div className="relative mt-3.5 flex items-end justify-between gap-3 sm:mt-5.5">
        <div className="min-w-0 whitespace-nowrap font-display text-[26px] font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-[34px]">
          {value}
        </div>
        {Icon && (
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card/80 ring-1 ring-inset sm:h-10 sm:w-10",
              ACCENT_CHIP[resolvedAccent],
            )}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export function ComingSoonCard({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="glass rounded-2xl p-10 text-center sm:p-14">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 font-display text-xl tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-accent">
        Coming soon
      </span>
    </div>
  );
}
