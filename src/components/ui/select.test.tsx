// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./select";

vi.mock("@/components/ui/dialog", () => ({
  useDialogDirty: () => ({ markDirty: markDirty }),
  useDialogPortalContainer: () => null,
}));
const { markDirty } = vi.hoisted(() => ({ markDirty: vi.fn() }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  markDirty.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function mount(count = 12, onChange = vi.fn()) {
  await act(async () => root.render(
    <Select defaultOpen defaultValue="2" onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>{Array.from({ length: count }, (_, i) =>
        <SelectItem key={i} value={String(i)}>{i === 2 ? "Bank of Baroda Ram Nagar" : `Client ${i}`}</SelectItem>
      )}</SelectGroup></SelectContent>
    </Select>,
  ));
  return onChange;
}
async function type(query: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search options"]');
  if (!input) throw new Error("Search missing");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Input setter missing");
  await act(async () => { setter.call(input, query); input.dispatchEvent(new Event("input", { bubbles: true })); });
  return input;
}
const visibleOptions = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).filter((item) => !item.hidden);
const accessibleValue = (item: Element | null) => {
  const copy = item?.cloneNode(true) as Element | undefined;
  copy?.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy?.textContent;
};

describe("long dropdown selection", () => {
  it("leaves short lists without search", async () => {
    await mount(2);
    expect(document.querySelector('input[aria-label="Search options"]')).toBeNull();
  });
  it("filters grouped lists without changing the selected label or marking the form dirty", async () => {
    await mount();
    await type("NAGAR bank");
    expect(visibleOptions().map(accessibleValue)).toEqual(["Bank of Baroda Ram Nagar"]);
    expect(host.textContent).toContain("Bank of Baroda Ram Nagar");
    expect(markDirty).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>('[role="option"][hidden]')?.hasAttribute("data-disabled")).toBe(true);
  });
  it("hands arrow navigation to matching options and selects with Enter", async () => {
    const onChange = await mount();
    const input = await type("Client 9");
    await act(async () => { input.focus(); input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(accessibleValue(document.activeElement)).toBe("Client 9");
    await act(async () => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith("9");
    expect(markDirty).toHaveBeenCalledTimes(1);
  });
  it("restores all options when search is cleared", async () => {
    await mount();
    await type("missing branch");
    expect(visibleOptions()).toHaveLength(0);
    await type("");
    expect(visibleOptions()).toHaveLength(12);
  });
});