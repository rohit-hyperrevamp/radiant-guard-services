/** Saved client status is the only operational visibility switch. */
export function isOperationalClient(row: { status?: string | null } | null | undefined): boolean {
  return row?.status === "active";
}

export function activeClientIds(rows: Array<{ id: string; status?: string | null }>): Set<string> {
  return new Set(rows.filter(isOperationalClient).map((row) => row.id));
}

export function visibleClientRows<T extends { id: string }>(rows: T[], allowed: ReadonlySet<string>): T[] {
  return rows.filter((row) => allowed.has(row.id));
}