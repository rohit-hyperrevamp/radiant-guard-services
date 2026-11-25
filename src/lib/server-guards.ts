/**
 * Small pure guards used by server endpoints: shared-secret checks for
 * scheduled hooks and a per-user sliding-window rate limiter.
 */

/** Constant-time string comparison (length is not secret here). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True only when a secret is configured and the request carries it, either in
 * the given header or as `Authorization: Bearer <secret>` (Vercel Cron style).
 * Fails closed when the env var is missing or too short.
 */
export function hookSecretOk(
  headers: { get(name: string): string | null },
  expected: string | undefined,
  headerName = "x-hook-secret",
): boolean {
  const secret = (expected ?? "").trim();
  if (secret.length < 16) return false;
  const direct = headers.get(headerName)?.trim() ?? "";
  const auth = headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return (direct.length > 0 && safeEqual(direct, secret)) || (bearer.length > 0 && safeEqual(bearer, secret));
}

/**
 * In-memory sliding-window limiter. Per server instance only — it slows abuse
 * from one session but is not a global quota.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Records a hit and returns false when the key is over its limit. */
    take(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    /** True while the key is under its limit (does not record a hit). */
    peek(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      hits.set(key, recent);
      return recent.length < limit;
    },
  };
}

/** Escape LIKE wildcards so an email can be matched exactly with ilike. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
