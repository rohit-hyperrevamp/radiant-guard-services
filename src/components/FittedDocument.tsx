import { useEffect, useRef, useState, type ReactNode } from "react";

/** Scale only the screen preview; retain the document's original print geometry. */
export function FittedDocument({ children, fitHeight = false }: { children: ReactNode; fitHeight?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const outer = frame.current;
    const inner = paper.current;
    if (!outer || !inner) return;
    const resize = () => {
      const width = inner.offsetWidth;
      const height = inner.offsetHeight;
      if (!width || !outer.clientWidth) return;
      const availableHeight = fitHeight ? outer.parentElement?.clientHeight : undefined;
      setScale(Math.min(1, outer.clientWidth / width, availableHeight && height ? availableHeight / height : 1));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(outer);
    observer.observe(inner);
    if (outer.parentElement) observer.observe(outer.parentElement);
    resize();
    return () => observer.disconnect();
  }, [fitHeight]);
  return <div ref={frame} className="w-full min-w-0"><div ref={paper} className="mx-auto w-max max-w-none" style={{ zoom: scale }}>{children}</div></div>;
}