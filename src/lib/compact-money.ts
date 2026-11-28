/**
 * Compact Indian money for headline figures: ₹14.92 Cr, ₹5.97 L, ₹12,450.
 * Display only — callers keep the exact value (e.g. in a title tooltip) and
 * every calculation stays on the full number.
 */
export function compactINR(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const n = Math.abs(value);
  const trim = (x: number) => x.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  if (n >= 1e7) return `${sign}₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `${sign}₹${trim(n / 1e5)} L`;
  return `${sign}₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Compact Indian number for chart axes: 1.4 Cr, 12.5 L, 45K, 900. */
export function compactNumberIN(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const sign = value < 0 ? "−" : "";
  const n = Math.abs(value);
  const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ""));
  if (n >= 1e7) return `${sign}${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `${sign}${trim(n / 1e5)} L`;
  if (n >= 1e3) return `${sign}${trim(n / 1e3)}K`;
  return `${sign}${Math.round(n * 100) / 100}`;
}
