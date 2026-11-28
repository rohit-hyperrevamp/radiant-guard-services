/**
 * Shared modern chart styling (recharts): brand-first palette, compact Indian
 * axis labels, hairline horizontal grid, no axis lines, soft tooltip card.
 */
import * as React from "react";
import { compactNumberIN } from "@/lib/compact-money";

export const CHART_PALETTE = [
  "oklch(0.585 0.197 259)", // brand blue
  "oklch(0.7 0.13 185)",    // teal
  "oklch(0.78 0.14 75)",    // amber
  "oklch(0.6 0.17 295)",    // violet
  "oklch(0.66 0.18 18)",    // coral
  "oklch(0.68 0.14 150)",   // green
  "oklch(0.62 0.1 235)",    // steel blue
  "oklch(0.72 0.12 340)",   // pink
  "oklch(0.55 0.03 260)",   // slate
  "oklch(0.75 0.13 110)",   // lime
];

export const chartGrid = { stroke: "var(--border)", strokeOpacity: 0.7, vertical: false, strokeDasharray: "0" } as const;

export const chartAxis = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 500 },
  tickMargin: 8,
} as const;

export const yAxisCompact = { ...chartAxis, width: 52, tickFormatter: (v: unknown) => (typeof v === "number" ? compactNumberIN(v) : String(v)) };

export const chartTooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "color-mix(in oklab, var(--card) 96%, transparent)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 12px 32px -16px rgb(15 23 42 / 0.25)",
    fontSize: 12.5,
    padding: "8px 12px",
  },
  labelStyle: { fontWeight: 600, color: "var(--foreground)", marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", padding: 0 },
  cursor: { fill: "color-mix(in oklab, var(--muted) 70%, transparent)" },
} as const;

export const fmtFull = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(v ?? ""));

/** Vertical fade used under area / bar series. */
export function ChartGradient({ id, color, from = 0.35, to = 0.02 }: { id: string; color: string; from?: number; to?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}

/** Small legend chips — only rendered when a chart actually has several series. */
export function ChartLegendChips({ items }: { items: { name: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}
