// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SmartListLayout } from "./SmartListLayout";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

it("retains secondary record values in an accessible detail dialog and leaves row actions intact", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} disconnect() {} } });
  const host = document.createElement("main");
  host.setAttribute("data-admin-scroll", "true");
  document.body.appendChild(host);
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
  const root = createRoot(host);
  const remove = vi.fn();
  await act(async () => {
    root.render(<><SmartListLayout /><div><table><thead><tr>{["ID", "Name", "Status", "Department", "Manager", "Joined", "Actions"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody><tr><td>494267</td><td>Shubham</td><td>Active</td><td>Finance</td><td>Vikrant</td><td>2026-10-21</td><td><button onClick={remove}>Delete</button></td></tr></tbody></table></div></>);
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
  const detail = host.querySelector<HTMLButtonElement>('button[aria-label^="More details:"]');
  expect(detail).not.toBeNull();
  await act(async () => detail?.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Vikrant");
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("2026-10-21");
  const original = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Delete");
  await act(async () => original?.click());
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  host.remove();
});