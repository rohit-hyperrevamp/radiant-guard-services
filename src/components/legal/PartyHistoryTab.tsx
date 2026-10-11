import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");
const esc = (s: string) => s.replace(/[%_,()]/g, " ").trim();

/** Look up any client / party name and see every case and notice we've had with them. */
export function PartyHistoryTab({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["legal-party-history", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const t = esc(term);
      const like = `%${t}%`;
      const [cust, units] = await Promise.all([
        db.from("customers").select("id").ilike("name", like).limit(50),
        db.from("units").select("id").ilike("name", like).limit(200),
      ]);
      const custIds = ((cust.data ?? []) as { id: string }[]).map((x) => x.id);
      const unitIds = ((units.data ?? []) as { id: string }[]).map((x) => x.id);
      const ors = [`party_name.ilike.${like}`, `opposing_party.ilike.${like}`, `title.ilike.${like}`];
      if (custIds.length) ors.push(`customer_id.in.(${custIds.join(",")})`);
      if (unitIds.length) ors.push(`unit_id.in.(${unitIds.join(",")})`);
      const [cases, notices] = await Promise.all([
        db
          .from("legal_cases")
          .select("id,case_number,title,status,party_name,opposing_party,court_or_authority,amount_involved,filed_on,closed_at,outcome")
          .or(ors.join(","))
          .order("created_at", { ascending: false })
          .limit(500),
        db
          .from("legal_notices")
          .select("id,notice_number,subject,status,to_name,notice_date")
          .or([`to_name.ilike.${like}`, ...(custIds.length ? [`customer_id.in.(${custIds.join(",")})`] : [])].join(","))
          .order("notice_date", { ascending: false })
          .limit(500),
      ]);
      return {
        cases: (cases.data ?? []) as {
          id: string;
          case_number: string;
          title: string;
          status: string;
          party_name: string | null;
          opposing_party: string | null;
          court_or_authority: string | null;
          amount_involved: number | null;
          filed_on: string | null;
          closed_at: string | null;
          outcome: string | null;
        }[],
        notices: (notices.data ?? []) as {
          id: string;
          notice_number: string;
          subject: string;
          status: string;
          to_name: string;
          notice_date: string;
        }[],
      };
    },
  });
  const open = q.data?.cases.filter((c) => c.status !== "closed").length ?? 0;
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(text.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Type a client, party or person's name…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button type="submit">Check history</Button>
      </form>
      {term && q.data && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="mb-2 flex items-center gap-1.5 font-medium">
            <History className="h-4 w-4 text-primary" />
            “{term}”: {q.data.cases.length} case{q.data.cases.length === 1 ? "" : "s"} ({open} not closed), {q.data.notices.length} notice
            {q.data.notices.length === 1 ? "" : "s"}
          </div>
          {q.data.cases.length + q.data.notices.length === 0 && (
            <div className="text-xs text-muted-foreground">No history with this name. Clean record with us.</div>
          )}
          <div className="space-y-1">
            {q.data.cases.map((c) => (
              <button key={c.id} onClick={() => onOpenCase(c.id)} className="block w-full rounded-md bg-muted/40 px-2 py-1.5 text-left text-xs hover:bg-muted">
                <div className="font-medium text-foreground">
                  {c.case_number} · {c.title} · <span className="capitalize">{c.status.replace("_", " ")}</span>
                </div>
                <div className="text-muted-foreground">
                  {c.party_name || c.opposing_party || "—"} · {c.court_or_authority || "—"} · filed {d(c.filed_on)}
                  {c.amount_involved != null ? ` · ₹${Number(c.amount_involved).toLocaleString("en-IN")}` : ""}
                  {c.closed_at ? ` · closed ${d(c.closed_at)}` : ""}
                  {c.outcome ? ` · ${c.outcome}` : ""}
                </div>
              </button>
            ))}
            {q.data.notices.map((n) => (
              <div key={n.id} className="rounded-md border border-border px-2 py-1.5 text-xs">
                <span className="font-medium">{n.notice_number}</span> · Notice to {n.to_name} · {n.subject} · {d(n.notice_date)} ·{" "}
                <span className="capitalize">{n.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {term && q.isLoading && <div className="text-sm text-muted-foreground">Searching…</div>}
    </div>
  );
}
