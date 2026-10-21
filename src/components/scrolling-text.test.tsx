// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { ScrollingText } from "./ScrollingText";

type CapturedKeyframes = Array<Record<string, unknown>>;
type CapturedOptions = { duration?: number; iterations?: number; easing?: string };

const captures: Array<{ keyframes: CapturedKeyframes; options: CapturedOptions }> = [];
const animations: Array<{ cancel: () => void; paused: boolean }> = [];

type Rfc = (entries: Array<{ isIntersecting: boolean }>) => void;

let resizeCbs: Array<{ cb: () => void }> = [];
let intersectCb: Rfc | null = null;

vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}));
vi.stubGlobal("ResizeObserver", class {
  constructor(cb: () => void) { resizeCbs.push({ cb }); }
  observe() {}
  unobserve() {}
  disconnect() { resizeCbs = []; }
});
vi.stubGlobal("IntersectionObserver", class {
  constructor(cb: Rfc) { intersectCb = cb; }
  observe() {}
  unobserve() {}
  disconnect() { intersectCb = null; }
});

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    animate: (k: CapturedKeyframes, o: CapturedOptions) => unknown;
  };
  proto.animate = (keyframes, options) => {
    captures.push({ keyframes, options });
    const animation = { cancel: () => {}, paused: false };
    animations.push(animation);
    return animation;
  };
});

const setSize = (el: Element, client: number, scroll: number) => {
  Object.defineProperty(el, "clientWidth", { value: client, configurable: true });
  Object.defineProperty(el, "scrollWidth", { value: scroll, configurable: true });
};

function mount(text: string): Root {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<ScrollingText text={text} />); });
  return root;
}

function trigger() {
  const frame = document.querySelector<HTMLElement>(".scrolling-text");
  const track = frame?.firstElementChild as HTMLElement;
  if (!frame || !track) throw new Error("scrolling-text not rendered");
  setSize(frame, 100, 100); // frame is 100px wide
  setSize(track, 400, 400); // track is 400px wide → 300px overflow
  for (const { cb } of resizeCbs) cb();
  intersectCb?.([{ isIntersecting: true }]);
  for (const { cb } of resizeCbs) cb();
  return { frame, track };
}

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots.length = 0;
  captures.length = 0;
});

describe("ScrollingText animation", () => {
  it("scrolls in one direction only: hold, sweep left, then restart jumps back", () => {
    roots.push(mount("Anz Acacia many extra words to overflow the narrow frame"));
    captures.length = 0;
    const { track } = trigger();
    expect(captures).toHaveLength(1);
    expect(track.textContent).toContain("Anz Acacia");
    const [{ keyframes, options }] = captures;
    expect(keyframes).toHaveLength(3);
    expect(keyframes[0].transform).toBe("translateX(0)");
    expect(keyframes[1].transform).toBe("translateX(0)");
    expect(keyframes[2].transform).toBe("translateX(-300px)");
    // Single direction: the sweep is the last segment and ends at the cycle end,
    // so the loop restart is an instant jump — never a backwards slide.
    expect(keyframes[2].offset).toBe(1);
    const duration = options.duration ?? 0;
    const travel = Math.max(2000, (300 / 24) * 1000);
    expect(duration).toBe(2000 + travel);
    expect(options.iterations).toBe(Infinity);
    // No keyframe between the hold and the end (no bounce segment).
    expect(keyframes.filter((k) => k.offset !== 0 && k.offset !== 1)).toHaveLength(1);
  });

  it("does not animate when the text fits its frame", () => {
    roots.push(mount("Short"));
    const frame = document.querySelector<HTMLElement>(".scrolling-text");
    const track = frame?.firstElementChild as HTMLElement;
    if (!frame || !track) throw new Error("scrolling-text not rendered");
    setSize(frame, 400, 400); // text fits: no overflow
    setSize(track, 400, 400);
    for (const { cb } of resizeCbs) cb();
    intersectCb?.([{ isIntersecting: true }]);
    for (const { cb } of resizeCbs) cb();
    expect(captures).toHaveLength(0);
  });
});
