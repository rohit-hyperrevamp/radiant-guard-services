/**
 * Duty-day quantities (P Days, Extra Duty days, totals) keep 4 decimals so an
 * Extra Duty entered in hours converts exactly (57.5 h ÷ 8 = 7.1875 days) and
 * is never rounded to 2 decimals. Only floating-point noise is removed.
 */
export function roundDutyDays(value: number): number {
  const n = Number(value) || 0;
  return Math.round(n * 10000) / 10000;
}
