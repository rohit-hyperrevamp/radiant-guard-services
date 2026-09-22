/**
 * Transient-network retry helper.
 *
 * Mobile WebViews and flaky office links routinely abort an in-flight request,
 * which surfaces as `TypeError: Failed to fetch` / `Load failed` / `NetworkError`.
 * Those are not rejections from the database — the write simply never reached it,
 * so retrying a few times is safe and stops the UI from reporting a false failure.
 */

const NETWORK_HINTS = [
  "failed to fetch",
  "load failed",
  "networkerror",
  "network request failed",
  "network error",
  "connection closed",
  "err_network",
  "err_internet_disconnected",
  "the internet connection appears to be offline",
  "fetch failed",
  "aborted",
];

export function isTransientNetworkError(e: unknown): boolean {
  const msg =
    e instanceof Error
      ? e.message
      : e && typeof e === "object"
        ? ((e as { message?: string }).message ?? "")
        : String(e ?? "");
  const low = msg.toLowerCase();
  return NETWORK_HINTS.some((hint) => low.includes(hint));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn`, retrying only on transient network failures.
 * Database/permission errors are rethrown immediately so real problems surface.
 */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delays = [500, 1200, 2400] }: { attempts?: number; delays?: number[] } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isTransientNetworkError(e) || i === attempts - 1) throw e;
      await wait(delays[i] ?? 1500);
    }
  }
  throw lastError;
}

/** Friendly wording for a network drop, so users do not see raw fetch errors. */
export function networkErrorMessage(e: unknown, fallback: string): string {
  if (isTransientNetworkError(e))
    return "Connection dropped before this could be saved. Check your internet and try again.";
  if (e instanceof Error) return e.message || fallback;
  if (e && typeof e === "object") {
    const err = e as { message?: string; details?: string; hint?: string };
    return err.message || err.details || err.hint || fallback;
  }
  return fallback;
}
