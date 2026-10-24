/** Update already-loaded employee slices after a successful save, never before it. */
export function patchEmployeeSlice<T extends { id: string; status: string }>(
  rows: T[] | undefined,
  record: T,
  inactive: boolean,
): T[] | undefined {
  if (!rows) return rows;
  const belongs = (record.status === "inactive") === inactive;
  const index = rows.findIndex((row) => row.id === record.id);
  if (!belongs) return index < 0 ? rows : rows.filter((row) => row.id !== record.id);
  if (index < 0) return [record, ...rows];
  return rows.map((row) => row.id === record.id ? { ...row, ...record } : row);
}