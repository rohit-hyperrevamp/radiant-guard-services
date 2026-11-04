// Attendance can carry a designation that is a naming variant of the
// contract's role (e.g. "Lady Guard" vs "Lady Security Guard"). Such days
// must still bill against the contract role instead of silently dropping.
export function normalizeDesignationName(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsecurity\b/g, " ")
    .replace(/\bfemale\b/g, "lady")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the contract designation id to bill `did` against, or `did` itself. */
export function resolveContractDesignation(
  did: string,
  contractDesignationIds: Iterable<string>,
  nameOf: (id: string) => string | undefined,
): string {
  const ids = Array.from(contractDesignationIds);
  if (!did || ids.includes(did)) return did;
  const want = normalizeDesignationName(nameOf(did));
  if (!want) return did;
  const hits = ids.filter((id) => normalizeDesignationName(nameOf(id)) === want);
  return hits.length === 1 ? hits[0] : did;
}
