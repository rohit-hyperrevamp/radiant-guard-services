import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabase-batch";

export type MonthDed = {
  candidate_id: string | null;
  amount: number | null;
  computed_amount: number | null;
  deduction_name: string | null;
};
export type MonthContrib = { candidate_id: string | null; amount: number | null; contribution_name: string | null };

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
}

/** One shared, fully paged read used by both the statutory and insurance tiles. */
export const complianceMonthQuery = (ym: string) => ({
  queryKey: ["compliance-month-ledger", ym],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { from, to } = monthRange(ym);
    const [deds, contribs] = await Promise.all([
      fetchAllPages<MonthDed>((a, b) =>
        supabase
          .from("deductions")
          .select("candidate_id, amount, computed_amount, deduction_name")
          .gte("deduction_date", from)
          .lte("deduction_date", to)
          .order("id")
          .range(a, b),
      ),
      fetchAllPages<MonthContrib>((a, b) =>
        supabase
          .from("employer_contributions")
          .select("candidate_id, amount, contribution_name")
          .gte("contribution_date", from)
          .lte("contribution_date", to)
          .order("id")
          .range(a, b),
      ),
    ]);
    return { deds, contribs };
  },
});
