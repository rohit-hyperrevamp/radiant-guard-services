/**
 * Duty-day quantities (P Days, Extra Duty days, totals) keep 4 decimals so an
 * Extra Duty entered in hours converts exactly (57.5 h ÷ 8 = 7.1875 days) and
 * is never rounded to 2 decimals. Only floating-point noise is removed.
 */
export function roundDutyDays(value: number): number {
  const n = Number(value) || 0;
  return Math.round(n * 10000) / 10000;
}

/** Printed duty quantity: at least 2 decimals, up to 4 when the value needs them (7.1875, 30.00). */
export function formatDutyQty(value: number): string {
  const n = roundDutyDays(value);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false });
}
