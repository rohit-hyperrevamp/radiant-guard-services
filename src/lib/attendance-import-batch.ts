/**
 * Batching helpers for attendance imports.
 *
 * Imports used to resolve and save one person at a time. People are now
 * resolved a few at a time and their rows saved in large upserts — without
 * letting two sheet rows that may be the same person race each other.
 */

const normToken = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Lanes of item indices (each lane in original order): items sharing any
 * normalised token (employee code, phone, name) land in the same lane, so a
 * person listed twice is still resolved strictly in sheet order. Lanes are
 * ordered by their first item.
 */
export function sharedTokenLanes(tokenLists: Array<Array<string | null | undefined>>): number[][] {
  const parent = tokenLists.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const owner = new Map<string, number>();
  tokenLists.forEach((tokens, i) => {
    for (const raw of tokens) {
      const t = normToken(String(raw ?? ""));
      if (!t) continue;
      const prev = owner.get(t);
      if (prev == null) owner.set(t, i);
      else {
        const a = find(prev);
        const b = find(i);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  });
  const lanes = new Map<number, number[]>();
  tokenLists.forEach((_, i) => {
    const root = find(i);
    const lane = lanes.get(root) ?? [];
    lane.push(i);
    lanes.set(root, lane);
  });
  return Array.from(lanes.values()).sort((x, y) => x[0]! - y[0]!);
}

/**
 * Run `fn` for every item: lanes run concurrently (at most `limit` at once),
 * items within a lane one after another. Results keep item order. The first
 * failure rejects (remaining lanes stop taking new items).
 */
export async function runInLanes<R>(
  lanes: number[][],
  limit: number,
  fn: (index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < lanes.length) {
      const lane = lanes[next++]!;
      for (const i of lane) {
        if (failed) return;
        try {
          results[i] = await fn(i);
        } catch (e) {
          failed = true;
          throw e;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, lanes.length)) }, worker));
  return results;
}

/**
 * Consecutive groups of items whose summed size stays within `maxRows`
 * (an item larger than the budget gets a group of its own). Item order kept.
 */
export function chunkByRowBudget<T>(items: T[], sizeOf: (item: T) => number, maxRows = 500): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let used = 0;
  for (const item of items) {
    const n = Math.max(0, sizeOf(item));
    if (cur.length && used + n > maxRows) {
      out.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(item);
    used += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Candidate ids that more than one lane resolved to (indices per id, in item order). */
export function crossLaneDuplicates(lanes: number[][], candidateOf: (index: number) => string | null | undefined): Map<string, number[]> {
  const laneOf = new Map<number, number>();
  lanes.forEach((lane, l) => lane.forEach((i) => laneOf.set(i, l)));
  const byId = new Map<string, number[]>();
  for (const i of Array.from(laneOf.keys()).sort((a, b) => a - b)) {
    const id = candidateOf(i);
    if (!id) continue;
    byId.set(id, [...(byId.get(id) ?? []), i]);
  }
  const out = new Map<string, number[]>();
  for (const [id, idx] of byId) {
    if (new Set(idx.map((i) => laneOf.get(i))).size > 1) out.set(id, idx);
  }
  return out;
}
