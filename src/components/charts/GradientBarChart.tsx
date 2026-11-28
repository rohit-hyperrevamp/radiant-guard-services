import * as React from "react";
import { chartAxis, chartGrid, chartTooltipStyle, yAxisCompact } from "./chart-theme";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

export type GradientBarDatum = { label: string; value: number };

type Props = {
  data: GradientBarDatum[];
  height?: number;
  gradientFrom?: string;
  gradientTo?: string;
  formatValue?: (n: number) => string;
  id?: string;
};

export function GradientBarChart({
  data,
  height = 220,
  gradientFrom = "oklch(0.585 0.197 259)",
  gradientTo = "oklch(0.585 0.197 259 / 0.7)",
  formatValue,
  id = "grad-bar",
}: Props) {
  const fmt = formatValue ?? ((n: number) => n.toLocaleString());
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 12, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientFrom} stopOpacity={1} />
              <stop offset="100%" stopColor={gradientTo} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="label" {...chartAxis} />
          <YAxis {...yAxisCompact} tickFormatter={formatValue ? (v) => (typeof v === "number" ? fmt(v) : String(v)) : yAxisCompact.tickFormatter} />
          <Tooltip {...chartTooltipStyle} formatter={(v: number) => [fmt(v), ""]} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44} fill={`url(#${id})`}>
            {data.map((_, i) => <Cell key={i} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
