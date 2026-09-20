import type { ComponentType, ReactNode } from "react";

import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import { ACCENT_CHIP, ACCENT_TILE_BG, type Accent } from "@/components/tile-theme";

/**
 * Charter tiles — the dashboard's pastel metric tiles, reused verbatim across
 * Attendance, Payroll and Invoice so all three landing pages read the same:
 * pastel surface, quiet label, oversized rolling numeral, accent icon chip and
 * an optional status breakdown strip (open / ready / processed).
 */

export function CharterTileGrid({ children }: { children: ReactNode }) {
  return <div className="scrollbar-hide -mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 lg:grid-cols-4">{children}</div>;
}

export type TileSegment = { label: string; value: number; tone?: "open" | "ready" | "done" };

const SEGMENT_TONE: Record<NonNullable<TileSegment["tone"]>, string> = {
  open: "text-rose-700 dark:text-rose-300",
  ready: "text-amber-700 dark:text-amber-300",
  done: "text-emerald-700 dark:text-emerald-300",
};

export function CharterTile({
  label,
  sub,
  value,
  countTo,
  icon: Icon,
  accent = "indigo",
  segments,
}: {
  label: string;
  sub?: string;
  /** Pre-formatted display value — used when `countTo` is not given. */
  value?: string;
  /** Numeric value; rolls up from zero like the dashboard tiles. */
  countTo?: number;
  icon?: ComponentType<{ className?: string }>;
  accent?: Accent;
  segments?: TileSegment[];
}) {
  const rolled = useCountUp(countTo ?? 0);
  const display = countTo == null ? (value ?? "—") : rolled;

  return (
    <div
      className={cn(
        "group relative flex min-h-[94px] w-[44vw] min-w-[148px] max-w-[184px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border/40 p-3 transition-colors sm:min-h-[138px] sm:w-auto sm:min-w-0 sm:max-w-none sm:rounded-2xl sm:p-4",
        ACCENT_TILE_BG[accent],
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
           <div className="line-clamp-2 font-display text-[12px] font-semibold leading-tight text-foreground sm:text-[15px]">
            {label}
          </div>
          {sub && (
             <div className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
              {sub}
            </div>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
               "grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-card/80 ring-1 ring-inset sm:h-9 sm:w-9 sm:rounded-full",
              ACCENT_CHIP[accent],
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        )}
      </div>

      <div className="relative mt-auto whitespace-nowrap pt-2 font-display text-[22px] font-bold leading-none tabular-nums text-foreground sm:text-[36px]">
        {display}
      </div>

      {segments && segments.length > 0 && (
        <div className="relative mt-1.5 flex flex-nowrap items-center gap-2 overflow-hidden sm:mt-3 sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
          {segments.map((s) => (
            <span key={s.label} className="flex items-baseline gap-1">
              <span
                className={cn(
                   "font-display text-[12px] font-bold tabular-nums sm:text-[15px]",
                  s.tone ? SEGMENT_TONE[s.tone] : "text-foreground",
                )}
              >
                {s.value}
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground sm:text-[10px] sm:uppercase">
                {s.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
