import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SecondaryPosting = {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  designation_id: string;
  designation_name: string;
  sort_order: number;
};

/** Billable postings the signed-in person holds beyond their main role (e.g. FO also a Security Guard). */
export function useSecondaryPostings(enabled = true) {
  const q = useQuery({
    queryKey: ["me", "secondary-postings"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SecondaryPosting[]> => {
      const { data, error } = await supabase.rpc("current_user_secondary_postings" as never);
      if (error) return [];
      return (data ?? []) as unknown as SecondaryPosting[];
    },
  });
  const postings = q.data ?? [];
  return { postings, hasSecondary: postings.length > 0, isLoading: q.isLoading };
}
