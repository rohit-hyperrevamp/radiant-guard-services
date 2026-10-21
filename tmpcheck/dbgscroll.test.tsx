// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ScrollingText } from "../src/components/ScrollingText";

vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });

describe("dbg", () => {
  it("renders", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<ScrollingText text="hello world this is long" />); });
    console.log("HTML:", host.innerHTML);
    console.log("animate fn:", typeof (HTMLElement.prototype as any).animate);
    expect(true).toBe(true);
  });
});
