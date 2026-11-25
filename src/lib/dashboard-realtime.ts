/**
 * Realtime → refetch throttling for dashboards and the app shell.
 *
 * Postgres change feeds fire on every row write: location beacons update
 * `self_attendance_punches` every few seconds per officer, bulk imports touch
 * thousands of rows. Invalidating queries on each event re-downloads whole
 * cards continuously and queues the small database instance. Every realtime
 * handler that refreshes data goes through `createThrottle`, which runs at
 * most once per window (leading call immediately, then one trailing call that
 * folds every event received inside the window).
 */

/** Minimum gap between realtime-driven refreshes. */
export const REALTIME_THROTTLE_MS = 30_000;

export type Throttle = {
  /** Request a run; executes now or once at the end of the current window. */
  run: () => void;
  /** Drop a pending trailing run (call on unmount). */
  cancel: () => void;
};

export function createThrottle(
  fn: () => void,
  ms: number = REALTIME_THROTTLE_MS,
  clock: () => number = () => Date.now(),
): Throttle {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const fire = () => {
    timer = null;
    if (cancelled) return;
    last = clock();
    fn();
  };
  return {
    run() {
      if (cancelled) return;
      const wait = ms - (clock() - last);
      if (wait <= 0) {
        fire();
        return;
      }
      if (timer) return;
      timer = setTimeout(fire, wait);
    },
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** Unique realtime channel name (React may mount a subscriber twice). */
export function uniqueChannelName(prefix: string): string {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}
