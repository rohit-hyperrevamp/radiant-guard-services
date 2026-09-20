import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HeroTile — the unified page hero used across every admin page.
 * Mirrors the dashboard "Leadership snapshot" tile.
 *
 *  ┌────────────────────────────────────────────────────────┐
 *  │ ◦ EYEBROW                            [right slot]      │
 *  │ Big Title       chip / subtitle                        │
 *  │ optional description line                              │
 *  └────────────────────────────────────────────────────────┘
 */
export interface HeroTileProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  chip?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function HeroTile({
  eyebrow,
  title,
  subtitle,
  chip,
  description,
  right,
  className,
  icon: Icon = Sparkles,
}: HeroTileProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-card px-3 py-2.5 sm:rounded-3xl sm:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-accent/80 sm:w-1" />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0 space-y-1 sm:space-y-3">
          {eyebrow && (
            <div className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/70 shadow-sm sm:inline-flex">
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-accent/15 text-accent">
                <Icon className="h-2 w-2" />
              </span>
              {eyebrow}
            </div>
          )}
          <div className="flex min-w-0 items-center gap-2 sm:flex-wrap sm:items-end">
            <div className="truncate font-display text-[19px] font-semibold leading-tight text-foreground sm:text-[30px] md:text-[34px]">
              {title}
            </div>
            {subtitle && (
              <div className="hidden pb-0.5 text-base font-medium text-muted-foreground/85 sm:block sm:text-lg">
                {subtitle}
              </div>
            )}
            {chip && (
              <span className="mb-0.5 inline-flex items-center rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent ring-1 ring-inset ring-accent/30">
                {chip}
              </span>
            )}
          </div>
          {description && (
            <p className="hidden max-w-2xl text-[13.5px] leading-snug text-muted-foreground sm:block">
              {description}
            </p>
          )}
        </div>

        {right && <div className="scrollbar-hide flex shrink-0 items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:gap-2">{right}</div>}
      </div>
    </div>
  );
}

