type Candidate = { id: string; unit_id: string | null; is_enabled: boolean | null; status: string | null };

/** Match the attendance sheet's enabled active/approved and site-assigned roster. */
export function visibleAttendanceCandidateIds(
  unitId: string,
  candidates: Candidate[],
  linkedIds: Iterable<string>,
  scopedIds: Iterable<string>,
): string[] {
  const assigned = new Set([...linkedIds, ...scopedIds]);
  return candidates.filter((c) => c.is_enabled === true &&
    (c.status === "active" || c.status === "approved") &&
    (c.unit_id === unitId || assigned.has(c.id))).map((c) => c.id);
}