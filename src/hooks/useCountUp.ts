import { useEffect, useRef, useState } from "react";

/**
 * Animate a number once, the first time a real value arrives.
 * Later changes (background refreshes, cached → fresh) show instantly,
 * so dashboard numbers never "roll" again while the user is looking.
 */
export function useCountUp(target: number, duration = 600, decimals = 0) {
  const safe = Number.isFinite(target) ? target : 0;
  const animatedRef = useRef(false);
  const [value, setValue] = useState(safe);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (animatedRef.current || safe === 0) {
      setValue(safe);
      return;
    }
    animatedRef.current = true;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(safe * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [safe, duration]);

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
}
