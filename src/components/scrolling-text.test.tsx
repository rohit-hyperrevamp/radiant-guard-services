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
  setSize(track.firstElementChild!, 400, 400); // text is 400px wide → overflows
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
  it("scrolls endlessly in one direction", () => {
    roots.push(mount("Anz Acacia many extra words to overflow the narrow frame"));
    captures.length = 0;
    const { track } = trigger();
    expect(captures.length).toBeGreaterThanOrEqual(1);
    expect(track.textContent).toContain("Anz Acacia");
    const { keyframes, options } = captures[captures.length - 1];
    // Endless single direction: only forward keyframes, looping by text + gap.
    expect(keyframes).toHaveLength(2);
    expect(keyframes[0].transform).toBe("translateX(0)");
    expect(keyframes[1].transform).toBe("translateX(-440px)");
    expect(options.iterations).toBe(Infinity);
    expect(options.easing).toBe("linear");
    expect(track.querySelector(".scrolling-text-copy")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not animate when the text fits its frame", () => {
    roots.push(mount("Short"));
    const frame = document.querySelector<HTMLElement>(".scrolling-text");
    const track = frame?.firstElementChild as HTMLElement;
    if (!frame || !track) throw new Error("scrolling-text not rendered");
    setSize(frame, 400, 400); // text fits: no overflow
    setSize(track.firstElementChild!, 400, 400);
    for (const { cb } of resizeCbs) cb();
    intersectCb?.([{ isIntersecting: true }]);
    for (const { cb } of resizeCbs) cb();
    expect(captures).toHaveLength(0);
  });
});
