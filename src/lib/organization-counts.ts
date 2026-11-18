/** Directory headline follows its status selection, independently of text search. */
export function organizationCounts(rows: readonly { status: string }[], statusFilter = "active") {
  const active = rows.filter((row) => row.status === "active").length;
  const inactive = rows.filter((row) => row.status === "inactive").length;
  const total = statusFilter === "all" ? rows.length : rows.filter((row) => row.status === statusFilter).length;
  return { active, inactive, total };
}