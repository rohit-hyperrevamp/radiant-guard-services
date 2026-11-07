import { QueryClient, QueryObserver, focusManager, onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoiceQueryFreshness } from "./invoice-query-freshness";

afterEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe("open invoice freshness", () => {
  it("reads saved duties again after attendance removal in another tab", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } });
    client.mount();
    let savedEntries = ["kept-a", "kept-b", "removed"];
    const read = vi.fn(async () => savedEntries.length);
    const observer = new QueryObserver(client, { queryKey: ["invoice-compute", "site"], queryFn: read, ...invoiceQueryFreshness });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe(3));
      focusManager.setFocused(false);
      savedEntries = ["kept-a", "kept-b"];
      focusManager.setFocused(true);
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe(2));
      expect(read).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
      client.unmount();
      client.clear();
    }
  });

  it("refreshes after reconnect instead of retaining the pre-edit count", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { refetchOnReconnect: false, retry: false } } });
    client.mount();
    let savedCount = 3;
    const observer = new QueryObserver(client, { queryKey: ["invoice-compute", "site"], queryFn: async () => savedCount, ...invoiceQueryFreshness });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe(3));
      onlineManager.setOnline(false);
      savedCount = 2;
      onlineManager.setOnline(true);
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe(2));
    } finally {
      unsubscribe();
      client.unmount();
      client.clear();
    }
  });
});