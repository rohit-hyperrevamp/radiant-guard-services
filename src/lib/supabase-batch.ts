/**
 * Batched Supabase reads.
 *
 * Two hard limits bite on this dataset:
 *  1. PostgREST returns at most 1000 rows per request unless you page with
 *     `.range()`.
 *  2. `.in("id", ids)` is serialised into the query string. With ~700 unit ids
 *     the URL blows past the gateway's URI limit and the request fails before
 *     it ever reaches the database — which is why Attendance / Invoice /
 *     Payroll rendered empty while smaller cards still worked.
 *
 * Everything that filters by a large id list must go through these helpers.
 */

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 100;
const CONCURRENCY = 4;

type QueryResult = { data: unknown; error: { message: string } | null };

/** Page through a query until a short page comes back. */
export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<QueryResult>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export function chunkIds(ids: string[], size: number = ID_CHUNK_SIZE): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

/**
 * Run an `.in(...)` filtered query in id chunks, paging each chunk, with a
 * small amount of parallelism. Returns the flattened rows.
 */
export async function fetchInChunks<T>(
  ids: string[],
  build: (chunk: string[], from: number, to: number) => PromiseLike<QueryResult>,
  options?: { chunkSize?: number; concurrency?: number },
): Promise<T[]> {
  const chunks = chunkIds(ids, options?.chunkSize ?? ID_CHUNK_SIZE);
  if (chunks.length === 0) return [];

  const limit = Math.max(1, options?.concurrency ?? CONCURRENCY);
  const rows: T[] = [];
  for (let i = 0; i < chunks.length; i += limit) {
    const batch = chunks.slice(i, i + limit);
    const results = await Promise.all(
      batch.map((chunk) => fetchAllPages<T>((from, to) => build(chunk, from, to))),
    );
    for (const r of results) rows.push(...r);
  }
  return rows;
}
