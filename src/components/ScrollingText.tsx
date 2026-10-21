import { memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const GAP = 40;

/** A single accessible copy; animate only measured overflow that is on screen. */
export const ScrollingText = memo(function ScrollingText({
  text, className,
}: { text: string | null | undefined; className?: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const value = text?.trim() || "—";

  useEffect(() => {
    const element = frame.current;
    const track = element?.firstElementChild;
    const item = track?.firstElementChild;
    if (!element || !(track instanceof HTMLElement) || !(item instanceof HTMLElement)) return;
    if (typeof window.matchMedia !== "function" || typeof ResizeObserver === "undefined"
      || typeof IntersectionObserver === "undefined" || typeof track.animate !== "function") {
      element.dataset.overflow = "true";
      element.dataset.static = "true";
      return;
    }
    delete element.dataset.static;
    let visible = false;
    let animation: Animation | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      animation?.cancel();
      animation = undefined;
      const width = item.scrollWidth;
      const distance = width - element.clientWidth;
      element.dataset.overflow = String(distance > 1);
      if (!visible || motion.matches || distance <= 1) return;
      // Endless marquee in one direction: a copy follows the text, so moving
      // by exactly one copy (text + gap) loops seamlessly — never backwards.
      const loop = width + GAP;
      animation = track.animate([
        { transform: "translateX(0)" },
        { transform: `translateX(-${loop}px)` },
      ], { duration: Math.max(4000, loop / 40 * 1000), iterations: Infinity, easing: "linear" });
    };
    const resize = new ResizeObserver(update);
    resize.observe(element);
    resize.observe(item);
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
    <span className="scrolling-text-track">
      <span className="scrolling-text-item">{value}</span>
      <span className="scrolling-text-copy" aria-hidden="true">{value}</span>
    </span>
  </span>;
});