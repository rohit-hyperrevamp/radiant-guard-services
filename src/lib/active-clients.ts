import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { fetchAllPages } from "@/lib/supabase-batch";
import { activeClientIds } from "@/lib/client-visibility";

/** A small paged status read; errors must not revive cached inactive clients. */
export async function fetchActiveClientIds(): Promise<Set<string>> {
  await supabaseSessionReady();
  const rows = await fetchAllPages<{ id: string; status: string }>((from, to) =>
    supabase.from("units").select("id,status").eq("status", "active")
      .order("id").range(from, to),
  );
  return activeClientIds(rows);
}