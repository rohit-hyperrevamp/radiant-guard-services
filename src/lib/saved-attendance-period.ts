export type SavedAttendancePeriod = {
  unit_id: string;
  period_start: string;
  period_end: string;
};

/** Exact saved window wins; a sole saved window ending in the selected month
 * remains authoritative after a contract window changes. Never guess among
 * multiple windows or borrow approval from an overlapping period. */
export function resolveSavedAttendancePeriod<T extends { start: string; end: string }>(
  unitId: string,
  expected: T,
  month: string,
  sheets: SavedAttendancePeriod[],
): T {
  const candidates = sheets.filter((s) => s.unit_id === unitId && s.period_end.slice(0, 7) === month);
  if (candidates.some((s) => s.period_start === expected.start && s.period_end === expected.end)) return expected;
  if (candidates.length !== 1) return expected;
  const saved = candidates[0];
  return { ...expected, start: saved.period_start, end: saved.period_end };
}