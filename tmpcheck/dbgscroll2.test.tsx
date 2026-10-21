// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ScrollingText } from "../src/components/ScrollingText";

const captures: any[] = [];
let resizeCbs: any[] = [];
let intersectCb: any = null;

vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal("ResizeObserver", class { constructor(cb: any) { resizeCbs.push({ cb }); } observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal("IntersectionObserver", class { constructor(cb: any) { intersectCb = cb; } observe() {} unobserve() {} disconnect() {} });

beforeAll(() => {
  (HTMLElement.prototype as any).animate = (k: any, o: any) => { captures.push({ k, o }); return { cancel() {}, pause() {}, play() {} }; };
});

describe("dbg2", () => {
  it("captures", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<ScrollingText text="Anz Acacia many extra words to overflow the narrow frame" />); });
    const frame = document.querySelector<HTMLElement>(".scrolling-text");
    const track = frame!.firstElementChild as HTMLElement;
    console.log("dataset before:", JSON.stringify(frame!.dataset), "animate:", typeof track.animate);
    Object.defineProperty(frame!, "clientWidth", { value: 100, configurable: true });
    Object.defineProperty(track, "scrollWidth", { value: 400, configurable: true });
    console.log("resizeCbs:", resizeCbs.length, "intersectCb:", typeof intersectCb);
    for (const { cb } of resizeCbs) cb();
    intersectCb([{ isIntersecting: true }]);
    for (const { cb } of resizeCbs) cb();
    console.log("dataset after:", JSON.stringify(frame!.dataset), "captures:", captures.length);
    expect(true).toBe(true);
  });
});
