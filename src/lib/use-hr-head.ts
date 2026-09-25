import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** True when the signed-in employee's designation is Head of HR ("HR Head"). */
export function useIsHrHead(): boolean {
  const { data } = useQuery({
    queryKey: ["current-user-is-hr-head"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: cid } = await supabase.rpc("current_user_candidate_id");
      if (!cid) return false;
      const { data: row } = await supabase
        .from("candidates")
        .select("role_key, designations:designation_id(name)")
        .eq("id", cid as string)
        .maybeSingle();
      const name = String((row as any)?.designations?.name ?? "").toLowerCase().replace(/\s+/g, " ");
      return /\b(hr head|head (of )?hr|head - hr|head human resources?)\b/.test(name);
    },
  });
  return data === true;
}
