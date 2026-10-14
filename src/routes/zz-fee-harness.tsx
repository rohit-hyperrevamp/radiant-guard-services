// TEMPORARY local debugging harness — delete after use.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourceFormDialog } from "@/routes/admin.contracts.client-contracts";
import fixture from "@/zz-fee-fixture.json";

export const Route = createFileRoute("/zz-fee-harness")({
  component: Harness,
});

function Harness() {
  const qc = useMemo(() => {
    const c = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    for (const e of (fixture as any).cache) c.setQueryData(e.key, e.data);
    return c;
  }, []);
  const idx = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("i") ?? 0) : 0;
  const [open, setOpen] = useState(true);
  const initial = (fixture as any).resources[idx];
  return (
    <QueryClientProvider client={qc}>
      <ResourceFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={initial}
        onSubmit={(r) => {
          (window as any).__submitted = r;
          setOpen(false);
        }}
      />
    </QueryClientProvider>
  );
}
