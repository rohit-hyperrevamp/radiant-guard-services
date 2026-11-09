import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { isOperationalClient } from "@/lib/client-visibility";

/** Do not mount a register (or its actions) for a disabled client, even by URL. */
export function ActiveClientBoundary({ unitId, children }: { unitId: string; children: ReactNode }) {
  const status = useQuery({
    queryKey: ["operational-client-status", unitId],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      await supabaseSessionReady();
      const { data, error } = await supabase.from("units").select("status").eq("id", unitId).maybeSingle();
      if (error) throw error;
      return isOperationalClient(data);
    },
  });
  if (status.isPending || status.isFetching) return <div role="status" className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (status.error) return <div role="alert" className="p-6 text-sm text-destructive">Could not check client status.</div>;
  if (!status.data) return <div className="p-6 text-sm text-muted-foreground">This client is inactive or unavailable.</div>;
  return children;
}