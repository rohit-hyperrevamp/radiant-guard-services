import { supabase } from "@/integrations/supabase/client";

/**
 * Contract / prospect code generation.
 *
 * Codes must be computed from EVERY existing code. A plain
 * `select("contract_code")` is silently capped at 1,000 rows by PostgREST, and
 * with 7,000+ contracts that produced an already-used code (e.g. CON16725) and
 * every approval failed on the unique constraint. Always use these helpers.
 */

const PAGE = 1000;

/** Highest numeric suffix for codes like `CON16729` / `PROS-0004`. */
export function maxCodeNumber(codes: readonly string[], prefix: RegExp): number {
  let max = 0;
  for (const code of codes) {
    const m = String(code ?? "").match(prefix);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

export function nextContractCodeFrom(codes: readonly string[]): string {
  // Prefix-anchored (not end-anchored) so suffixed codes like CON16729A still count.
  return `CON${String(maxCodeNumber(codes, /^CON(\d+)/i) + 1).padStart(5, "0")}`;
}

export function nextProspectCodeFrom(codes: readonly string[]): string {
  return `PROS-${String(maxCodeNumber(codes, /^PROS-?(\d+)/i) + 1).padStart(4, "0")}`;
}

/** Reads one code column across all client_contracts rows, page by page. */
export async function fetchAllCodes(column: "contract_code" | "prospect_code"): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("client_contracts" as never)
      .select(`id,${column}`)
      .not(column, "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of rows) {
      const v = String(r[column] ?? "").trim();
      if (v) out.push(v);
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Next free contract code. Uses the DB function when deployed, else pages all codes. */
export async function generateNextContractCode(): Promise<string> {
  // The DB function ships in a separate migration; until it is applied this call
  // errors and we fall back to paging every code.
  const rpc = (await supabase.rpc("next_contract_code" as never)) as unknown as {
    data: unknown;
    error: unknown;
  };
  if (!rpc.error && typeof rpc.data === "string" && /^CON\d+$/i.test(rpc.data)) return rpc.data;
  return nextContractCodeFrom(await fetchAllCodes("contract_code"));
}

export async function generateNextProspectCode(): Promise<string> {
  return nextProspectCodeFrom(await fetchAllCodes("prospect_code"));
}

/** True when a Supabase/Postgres error is a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "23505" || /duplicate key|unique constraint/i.test(e?.message ?? "");
}

/**
 * Runs `write(code)` with a freshly generated contract code, retrying with a
 * new code if another user took the same one in the meantime.
 */
export async function withFreshContractCode<T>(
  write: (code: string) => Promise<{ error: unknown; data?: T }>,
  attempts = 3,
): Promise<{ code: string; data?: T }> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const code = await generateNextContractCode();
    const { error, data } = await write(code);
    if (!error) return { code, data };
    lastError = error;
    if (!isUniqueViolation(error)) break;
  }
  throw lastError;
}
