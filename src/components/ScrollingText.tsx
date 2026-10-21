import { memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** A single accessible copy; animate only measured overflow that is on screen. */
export const ScrollingText = memo(function ScrollingText({
  text, className,
}: { text: string | null | undefined; className?: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const value = text?.trim() || "—";

  useEffect(() => {
    const element = frame.current;
    const track = element?.firstElementChild;
    if (!element || !(track instanceof HTMLElement)) return;
    let visible = false;
    let animation: Animation | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      animation?.cancel();
      animation = undefined;
      const distance = track.scrollWidth - element.clientWidth;
      element.dataset.overflow = String(distance > 1);
      if (!visible || motion.matches || distance <= 1) return;
      const travel = Math.max(2000, distance / 24 * 1000);
      const duration = travel * 2 + 4000;
      animation = track.animate([
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: 2000 / duration },
        { transform: `translateX(-${distance}px)`, offset: (2000 + travel) / duration },
        { transform: `translateX(-${distance}px)`, offset: (4000 + travel) / duration },
        { transform: "translateX(0)", offset: 1 },
      ], { duration, iterations: Infinity, easing: "linear" });
    };
    const resize = new ResizeObserver(update);
    resize.observe(element);
    resize.observe(track);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      update();
    });
    intersection.observe(element);
    const pause = () => animation?.pause();
    const resume = () => animation?.play();
    element.addEventListener("pointerenter", pause);
    element.addEventListener("pointerleave", resume);
    element.addEventListener("focusin", pause);
    element.addEventListener("focusout", resume);
    motion.addEventListener("change", update);
    return () => {
      animation?.cancel();
      resize.disconnect();
      intersection.disconnect();
      element.removeEventListener("pointerenter", pause);
      element.removeEventListener("pointerleave", resume);
      element.removeEventListener("focusin", pause);
      element.removeEventListener("focusout", resume);
      motion.removeEventListener("change", update);
    };
  }, [value]);

  return <span ref={frame} className={cn("scrolling-text", className)} title={value}>
    <span className="scrolling-text-track">{value}</span>
  </span>;
});