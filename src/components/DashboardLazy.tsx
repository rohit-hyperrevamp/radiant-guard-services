import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dashboard render scheduling.
 *
 * - `LazyMount` renders its children only once the placeholder scrolls near
 *   the viewport, so below-the-fold cards fire no requests on page load.
 * - `DeferredMount` renders its children after `ready` turns true and the
 *   browser is idle, so slow above-the-fold cards queue behind the tiles
 *   instead of competing with them.
 *
 * Both keep children mounted afterwards (scrolling away never refetches).
 */

/** Run `cb` when the main thread is idle (falls back to a short timeout). */
export function whenIdle(cb: () => void, timeout = 1_500): () => void {
  if (typeof window === "undefined") {
    cb();
    return () => {};
  }
  const w = window as Window & {
    requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(cb, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 200);
  return () => window.clearTimeout(id);
}

export function LazyMount({
  children,
  minHeight = 160,
  rootMargin = "300px 0px",
  className,
}: {
  children: React.ReactNode;
  /** Placeholder height so the page does not jump and the observer has a box. */
  minHeight?: number;
  rootMargin?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);
  if (visible) return <>{children}</>;
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("rounded-2xl border border-border/40 bg-card/40", className)}
      style={{ minHeight }}
    />
  );
}

export function DeferredMount({
  ready = true,
  children,
  fallback = null,
  delayMs = 0,
}: {
  ready?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Extra wait after `ready`, so the first tiles' requests go out first. */
  delayMs?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (mounted || !ready) return;
    let cancelIdle = () => {};
    const t = setTimeout(() => {
      cancelIdle = whenIdle(() => setMounted(true));
    }, delayMs);
    return () => {
      clearTimeout(t);
      cancelIdle();
    };
  }, [mounted, ready, delayMs]);
  return <>{mounted ? children : fallback}</>;
}

/** Placeholder with the dashboard tile footprint. */
export function TileSkeleton() {
  return (
    <div
      aria-hidden
      className="h-full min-h-[124px] animate-pulse rounded-2xl border border-border/60 bg-card sm:min-h-[172px] sm:rounded-[26px]"
    />
  );
}

/**
 * Whether the media query matches; `null` until measured on the client, so
 * callers can render exactly one variant instead of mounting both.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setMatches(true);
      return;
    }
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, [query]);
  return matches;
}
