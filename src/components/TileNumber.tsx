import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fit the complete value to the space remaining beside icons and labels. */
export function TileNumber({ children, className }: { children: ReactNode; className?: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = container.current;
    const content = text.current;
    if (!box || !content) return;
    let active = true;
    const fit = () => {
      if (!active || box.clientWidth === 0) return;
      const base = parseFloat(getComputedStyle(box).fontSize);
      content.style.setProperty("font-size", `${base}px`, "important");
      const natural = content.getBoundingClientRect().width;
      if (natural > box.clientWidth)
        content.style.setProperty(
          "font-size",
          `${(base * (box.clientWidth - 1)) / natural}px`,
          "important",
        );
    };
    fit();
    let lastWidth = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (lastWidth !== box.clientWidth) {
        lastWidth = box.clientWidth;
        fit();
      }
    });
    observer.observe(box);
    window.addEventListener("resize", fit);
    document.fonts.ready.then(fit);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [children]);
  return (
    <span
      ref={container}
      data-tile-number
      className={cn("block min-w-0 flex-1 tabular-nums leading-none", className)}
    >
      <span ref={text} className="inline-block w-max whitespace-nowrap tracking-normal">
        {children}
      </span>
    </span>
  );
}
