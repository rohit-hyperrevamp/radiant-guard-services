import { QueryClient, type Query } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSkeleton } from "@/components/Skeletons";

const STALE_BUILD_RELOAD_KEY = "radiant.stale-build-reload";

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const lastReload = Number(window.sessionStorage.getItem(STALE_BUILD_RELOAD_KEY) ?? 0);
    if (Date.now() - lastReload < 30_000) return;
    window.sessionStorage.setItem(STALE_BUILD_RELOAD_KEY, String(Date.now()));
    window.location.reload();
  });
}

/**
 * Session-scoped identity reads (role, permissions, profile, org scope). The
 * whole app shell and most cards read them, and every navigation mounts new
 * observers — with the global `refetchOnMount: true` each page refetched them
 * once they were 5 min old. Fetch them once per session instead: refetch on
 * mount only while the cached value has never come from the network (e.g. a
 * localStorage snapshot passed as initialData) or was invalidated. Sign-out
 * clears the cache; RBAC edits invalidate explicitly.
 */
export const SESSION_QUERY_ROOTS = [
  "rbac",
  "me-profile",
  "me",
  "current-user-role",
  "manager-fo-scope",
  "user-branch-scope",
  "team-people-direct",
] as const;

export function refetchOnMountOncePerSession(query: Query): boolean {
  return query.state.dataUpdateCount === 0 || query.state.isInvalidated;
}

export function applySessionQueryDefaults(queryClient: QueryClient) {
  for (const root of SESSION_QUERY_ROOTS) {
    queryClient.setQueryDefaults([root], {
      refetchOnMount: refetchOnMountOncePerSession,
      gcTime: 2 * 60 * 60_000,
    });
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache aggressively — admin reference data (designations, service
        // types, allowances, etc.) barely changes between navigations.
        staleTime: 5 * 60 * 1000, // 5 min: served instantly from cache
        gcTime: 30 * 60 * 1000, // 30 min in memory
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Refetch when a component re-mounts if the query is stale.
        // After a mutation calls invalidateQueries, this guarantees the
        // very next visit to that page shows fresh data instead of a
        // cached copy — the "count updates but the row is missing until
        // I refresh" symptom users see across admin lists.
        refetchOnMount: true,
        retry: 1,
      },
    },
  });

  applySessionQueryDefaults(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 400,
  });

  return router;
};
