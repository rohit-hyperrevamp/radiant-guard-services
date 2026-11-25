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
      // Look names up separately: the live schema has no candidates→designations
      // foreign key, so an embedded select fails (PGRST200).
      const { data: row } = await supabase
        .from("candidates")
        .select("role_key, designation_id, department_id")
        .eq("id", cid as string)
        .maybeSingle();
      const r = (row ?? {}) as { designation_id?: string | null; department_id?: string | null };
      const [desig, deptRow] = await Promise.all([
        r.designation_id
          ? supabase.from("designations").select("name").eq("id", r.designation_id).maybeSingle()
          : Promise.resolve({ data: null }),
        r.department_id
          ? supabase.from("departments").select("name").eq("id", r.department_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const name = String((desig.data as { name?: string } | null)?.name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
      const dept = String((deptRow.data as { name?: string } | null)?.name ?? "").toLowerCase().trim();
      if (name === "head" && dept === "hr") return true;
      return /\b(hr head|head (of )?hr|head - hr|head human resources?)\b/.test(name);
    },
  });
  return data === true;
}
