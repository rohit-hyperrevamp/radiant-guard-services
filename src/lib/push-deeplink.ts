// Safe in-app navigation for push-notification deep links.
//
// Notification payloads carry an app-relative `link` (e.g. "/admin/attendance").
// Assigning `window.location.href` forced a full document load, so a stale or
// unknown link rendered a hard 404 page inside the native shell. Instead we
// resolve the link against the live router: unknown paths fall back to the
// app home so a notification tap always lands on a real screen.

type AnyRouter = {
  navigate: (opts: { to: string; replace?: boolean }) => unknown;
  buildLocation: (opts: { to: string }) => unknown;
  matchRoutes: (location: unknown) => Array<{ status?: string; globalNotFound?: boolean }>;
};

let router: AnyRouter | null = null;
let pendingLink: string | null = null;

export function setPushRouter(next: unknown) {
  router = next as AnyRouter;
  if (pendingLink) {
    const link = pendingLink;
    pendingLink = null;
    openPushLink(link);
  }
}

function isKnownRoute(link: string): boolean {
  if (!router) return false;
  try {
    const matches = router.matchRoutes(router.buildLocation({ to: link }));
    if (!matches || matches.length === 0) return false;
    return !matches.some((m) => m.globalNotFound || m.status === "notFound");
  } catch {
    return false;
  }
}

/** Navigate to a notification deep link, falling back to the app home. */
export function openPushLink(rawLink: string | undefined | null) {
  if (typeof window === "undefined") return;
  const link = (rawLink ?? "").trim();
  // Only same-app absolute paths are ever followed.
  const target = link.startsWith("/") && !link.startsWith("//") ? link : "/";

  if (!router) {
    // Listeners can fire before React mounts (cold start from a tap).
    pendingLink = target;
    return;
  }

  const to = isKnownRoute(target) ? target : "/";
  try {
    void router.navigate({ to });
  } catch {
    window.location.href = "/";
  }
}
