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
const ID_CHUNK_SIZE = 150;
const CONCURRENCY = 8;
/** Max bulk reads one browser tab keeps in flight at once (all screens/loaders together). */
export const BULK_POOL_SIZE = 6;

/**
 * Tiny promise pool: at most `limit` tasks run at once; the rest wait in FIFO
 * order. Tasks must be leaf work (a single request / page loop) — a task that
 * itself waits on the same pool could deadlock it.
 */
export type PromisePool = {
  run<T>(task: () => PromiseLike<T> | T): Promise<T>;
  readonly active: number;
  readonly queued: number;
};

export function createPool(limit: number): PromisePool {
  const max = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    if (active >= max) return;
    const start = waiting.shift();
    if (start) start();
  };
  return {
    get active() { return active; },
    get queued() { return waiting.length; },
    run<T>(task: () => PromiseLike<T> | T): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          active++;
          let result: PromiseLike<T> | T;
          try {
            result = task();
          } catch (e) {
            active--;
            reject(e);
            next();
            return;
          }
          Promise.resolve(result).then(
            (v) => { active--; resolve(v); next(); },
            (e) => { active--; reject(e); next(); },
          );
        };
        waiting.push(start);
        next();
      });
    },
  };
}

/**
 * The tab-wide pool every bulk loader shares, so one screen can never fire
 * 30+ concurrent requests into the (small) database. Server code is not
 * pooled — a process-wide cap there would serialise unrelated requests.
 */
const browserPool = createPool(BULK_POOL_SIZE);
export function runBulk<T>(task: () => PromiseLike<T> | T): Promise<T> {
  if (typeof window === "undefined") return Promise.resolve().then(task);
  return browserPool.run(task);
}

/** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapPool<I, O>(items: I[], limit: number, fn: (item: I, index: number) => PromiseLike<O> | O): Promise<O[]> {
  const pool = createPool(limit);
  return Promise.all(items.map((item, i) => pool.run(() => fn(item, i))));
}

type QueryResult = { data: unknown; error: { message: string } | null };

/** Keep a single renderable row per primary key, including previously cached pages. */
export function uniqueRowsById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

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
  // Per-call cap, and every chunk also waits for a slot in the tab-wide pool.
  const results = await mapPool(chunks, limit, (chunk) =>
    runBulk(() => fetchAllPages<T>((from, to) => build(chunk, from, to))),
  );
  return results.flat();
}

/**
 * Rows for a large id set: above `scanThreshold` ids, one server-filtered
 * scan (e.g. "this period's rows") paged 1,000 at a time beats a dozen URL-
 * limited `.in()` chunks; the scan is narrowed to `ids` in memory. Below it,
 * plain id chunks. Both paths must select the same rows for the given ids.
 */
export async function fetchForIds<T>(
  ids: string[],
  options: {
    chunk: (chunk: string[], from: number, to: number) => PromiseLike<QueryResult>;
    scan: (from: number, to: number) => PromiseLike<QueryResult>;
    idOf: (row: T) => string | null | undefined;
    scanThreshold?: number;
    chunkSize?: number;
  },
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];
  if (unique.length <= (options.scanThreshold ?? ID_CHUNK_SIZE * 3)) {
    return fetchInChunks<T>(unique, options.chunk, { chunkSize: options.chunkSize });
  }
  const wanted = new Set(unique);
  const rows = await runBulk(() => fetchAllPages<T>(options.scan));
  return rows.filter((row) => wanted.has(String(options.idOf(row) ?? "")));
}

type CountedQueryResult = QueryResult & { count?: number | null };

/**
 * Page through an ordered query with the later pages fetched in parallel.
 *
 * `build(from, to, first)` must return the same ordered query for every page
 * (a unique tie-breaker in `.order()` is mandatory, otherwise pages overlap or
 * skip rows); on the first page (`first === true`) it should request
 * `{ count: "exact" }`. Once the total is known the remaining ranges run at
 * once, each through `run` (e.g. `runBulk`, so the tab-wide pool still caps
 * concurrency — pass a per-request runner, never one that wraps this call).
 * Without a count, or if the last page comes back full (rows were added
 * meanwhile), it carries on serially — it never returns fewer rows than
 * `fetchAllPages`.
 */
export async function fetchAllPagesParallel<T>(
  build: (from: number, to: number, first: boolean) => PromiseLike<CountedQueryResult>,
  options?: { pageSize?: number; run?: <R>(task: () => PromiseLike<R>) => Promise<R> },
): Promise<T[]> {
  const size = Math.max(1, options?.pageSize ?? PAGE_SIZE);
  const run = options?.run ?? (<R>(task: () => PromiseLike<R>) => Promise.resolve(task()));
  const first = await run(() => build(0, size - 1, true));
  if (first.error) throw first.error;
  const rows: T[] = [...((first.data ?? []) as T[])];
  if (rows.length < size) return rows;

  let nextFrom = size;
  const total = typeof first.count === "number" ? first.count : null;
  if (total != null && total > size) {
    const starts: number[] = [];
    for (let from = size; from < total; from += size) starts.push(from);
    const pages = await Promise.all(starts.map((from) => run(() => build(from, from + size - 1, false))));
    let lastFull = true;
    for (const page of pages) {
      if (page.error) throw page.error;
      const data = (page.data ?? []) as T[];
      rows.push(...data);
      lastFull = data.length >= size;
    }
    if (!lastFull) return rows;
    nextFrom = starts[starts.length - 1] + size;
  }
  // Serial tail: unknown count, or the result grew past the counted end.
  for (let from = nextFrom; ; from += size) {
    const page = await run(() => build(from, from + size - 1, false));
    if (page.error) throw page.error;
    const data = (page.data ?? []) as T[];
    rows.push(...data);
    if (data.length < size) break;
  }
  return rows;
}
