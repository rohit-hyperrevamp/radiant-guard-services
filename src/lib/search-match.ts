/**
 * Shared, forgiving text search used by list pages and pickers.
 * - case-insensitive, ignores dots/extra spaces
 * - every word must appear somewhere, any order ("singh tarun" finds "Tarun Kumar Singh")
 * - digit-only words also match phone numbers written with +91 / spaces / dashes
 */
export function searchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function matchesSearch(query: string, fields: Array<string | null | undefined>): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ");
  const hayDigits = fields.map((f) => digitsOnly(f ?? "")).join(" ");
  const phoneQuery = digitsOnly(query);
  if (phoneQuery.length >= 4 && /^[\d\s+()-]+$/.test(query.trim())) {
    const q = phoneQuery.length > 10 && phoneQuery.startsWith("91") ? phoneQuery.slice(-10) : phoneQuery;
    if (hayDigits.includes(q)) return true;
  }
  return tokens.every((t) => hay.includes(t));
}

/** Sort rank: active first, expired last. */
export function statusRank(status: string | null | undefined): number {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return 0;
  if (s === "expired") return 3;
  if (s === "inactive" || s === "disabled") return 2;
  return 1;
}

/** Build a PostgREST `or` filter per word, so server searches match any word order. */
export function serverSearchWords(query: string): string[] {
  return searchTokens(query).map((w) => w.replace(/[%,()*]/g, "")).filter(Boolean).slice(0, 4);
}

/** Pre-built search text for one row — build once per list, reuse on every keystroke. */
export type SearchHay = { text: string; digits: string };
export function buildSearchHay(fields: Array<string | null | undefined>): SearchHay {
  return {
    text: fields.filter(Boolean).join(" ").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " "),
    digits: fields.map((f) => digitsOnly(f ?? "")).join(" "),
  };
}

/** Compile a query once; the returned test is cheap enough for thousands of rows. */
export function compileSearch(query: string): ((hay: SearchHay) => boolean) | null {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return null;
  const phoneQuery = digitsOnly(query);
  const phone =
    phoneQuery.length >= 4 && /^[\d\s+()-]+$/.test(query.trim())
      ? phoneQuery.length > 10 && phoneQuery.startsWith("91") ? phoneQuery.slice(-10) : phoneQuery
      : null;
  return (hay) => (phone !== null && hay.digits.includes(phone)) || tokens.every((t) => hay.text.includes(t));
}
