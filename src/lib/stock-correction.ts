export function stockCorrectionDelta(current: number, target: number): number {
  if (!Number.isFinite(target) || target < 0) throw new Error("Enter a valid non-negative quantity");
  if (!Number.isFinite(current)) throw new Error("Current quantity is unavailable");
  if (target === current) throw new Error("Quantity has not changed");
  return target - current;
}