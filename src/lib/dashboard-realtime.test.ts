import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle, REALTIME_THROTTLE_MS, uniqueChannelName } from "./dashboard-realtime";

describe("createThrottle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the first event immediately and folds a burst into one trailing run", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 30_000);
    t.run();
    expect(fn).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 50; i++) t.run();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(29_999);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never runs more than once per window under a steady stream", () => {
    const fn = vi.fn();
    const t = createThrottle(fn);
    for (let s = 0; s < 120; s++) {
      t.run();
      vi.advanceTimersByTime(1_000);
    }
    // 120 s of events → leading + one per 30 s window.
    expect(fn.mock.calls.length).toBeLessThanOrEqual(5);
    expect(REALTIME_THROTTLE_MS).toBeGreaterThanOrEqual(30_000);
  });

  it("drops the pending run after cancel", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 1_000);
    t.run();
    t.run();
    t.cancel();
    vi.advanceTimersByTime(5_000);
    t.run();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("uniqueChannelName", () => {
  it("keeps the prefix and never repeats", () => {
    const a = uniqueChannelName("x");
    const b = uniqueChannelName("x");
    expect(a.startsWith("x-")).toBe(true);
    expect(a).not.toBe(b);
  });
});
