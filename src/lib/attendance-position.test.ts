import { afterEach, describe, expect, it, vi } from "vitest";
import { attendancePositionStatus, freshBrowserPosition } from "./attendance-position";

afterEach(() => vi.useRealTimers());

describe("HO attendance position", () => {
  it("keeps the office-only 300m boundary even for a 1.42km coarse fix", () => {
    expect(attendancePositionStatus(300, 11, 300)).toBe("within");
    expect(attendancePositionStatus(301, 1, 300)).not.toBe("within");
    expect(attendancePositionStatus(1420, 2000, 300)).toBe("uncertain");
    expect(attendancePositionStatus(1420, 188617.4, 300)).toBe("uncertain");
    expect(attendancePositionStatus(1420, 11, 300)).toBe("outside");
  });
  it("waits for a precise fresh reading instead of accepting the first coarse reading", async () => {
    vi.useFakeTimers();
    let success: PositionCallback | undefined;
    const clearWatch = vi.fn();
    const watchPosition = vi.fn((callback: PositionCallback) => { success = callback; return 7; });
    const geo = { watchPosition, clearWatch } as unknown as Geolocation;
    const result = freshBrowserPosition(geo);
    const fix = (accuracy: number, timestamp = Date.now()) => ({ timestamp, coords: { latitude: 18.4673107, longitude: 73.901964, accuracy } }) as GeolocationPosition;
    success?.(fix(11, Date.now() - 30_000)); // Cached fix is ignored.
    success?.(fix(2000));
    expect(clearWatch).not.toHaveBeenCalled();
    success?.(fix(11.12));
    expect((await result).coords.accuracy).toBe(11.12);
    expect(watchPosition.mock.calls[0]?.[0]).toBeTypeOf("function");
    expect(watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });
  it("returns the best measured fix at the deadline and stops watching", async () => {
    vi.useFakeTimers();
    let success: PositionCallback | undefined;
    const clearWatch = vi.fn();
    const geo = { watchPosition: (callback: PositionCallback) => { success = callback; return 8; }, clearWatch } as unknown as Geolocation;
    const result = freshBrowserPosition(geo);
    for (const accuracy of [2000, 500, 1800]) success?.({ timestamp: Date.now(), coords: { latitude: 18.46, longitude: 73.90, accuracy } } as GeolocationPosition);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await result).coords.accuracy).toBe(500);
    expect(clearWatch).toHaveBeenCalledWith(8);
  });
});