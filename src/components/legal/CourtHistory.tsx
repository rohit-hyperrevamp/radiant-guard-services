import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRightLeft, Landmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/SearchSelect";
import { CreatableSelect } from "@/components/CreatableSelect";
import { confirmAction } from "@/components/ConfirmProvider";
import { ensureCourt, useLegalMasters, LEGAL_MASTERS_KEY } from "@/lib/legal";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Row = {
  id: string;
  court_id: string | null;
  court_name: string;
  reference_no: string | null;
  state: string | null;
  from_date: string | null;
  note: string;
  is_current: boolean;
  created_at: string;
};
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");

export function courtOptions(courts: { id: string; name: string; court_type: string; state: string; city: string }[]) {
  return courts.map((c) => ({
    value: c.id,
    label: c.name,
    hint: [c.court_type, c.city, c.state].filter(Boolean).join(" · "),
  }));
}

/** Court & reference-number history for one case. A transfer adds a new row; old rows stay. */
export function CourtHistory({
  caseId,
  caseNumber,
  caseState,
  canEdit,
  onChanged,
}: {
  caseId: string;
  caseNumber: string;
  caseState: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const m = useLegalMasters();
  const q = useQuery({
    queryKey: ["legal-case-courts", caseId],
    queryFn: async () => {
      const { data, error } = await db
        .from("legal_case_courts")
        .select("*")
        .eq("case_id", caseId)
        .order("from_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const [adding, setAdding] = useState(false);
  const [courtId, setCourtId] = useState("");
  const [courtName, setCourtName] = useState("");
  const [ref, setRef] = useState("");
  const [state, setState] = useState(caseState ?? "");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const rows = q.data ?? [];
  const first = rows.length === 0;

  const save = async () => {
    const court = m.data?.courts.find((c) => c.id === courtId);
    const name = court?.name ?? courtName.trim();
    if (!name) return toast.error("Choose or type the court");
    if (
      !(await confirmAction({
        title: first ? "Save the court for this case?" : "Record a change of court?",
        description: first ? undefined : "The current court stays in the history; the new one becomes current.",
        confirmText: "Yes, save",
      }))
    )
      return;
    let cid = court?.id ?? null;
    if (!cid) {
      try {
        cid = await ensureCourt(name, state);
        qc.invalidateQueries({ queryKey: LEGAL_MASTERS_KEY });
      } catch {
        cid = null;
      }
    }
    await db.from("legal_case_courts").update({ is_current: false }).eq("case_id", caseId);
    const { error } = await db.from("legal_case_courts").insert({
      case_id: caseId,
      court_id: cid,
      court_name: name,
      reference_no: ref.trim() || null,
      state: state || null,
      from_date: from || null,
      note: note.trim() || (first ? "Original filing" : "Transferred"),
      is_current: true,
    });
    if (error) return toast.error(error.message);
    await db
      .from("legal_cases")
      .update({ court_or_authority: name, reference_no: ref.trim() || null, ...(state ? { state } : {}) })
      .eq("id", caseId);
    await db.from("legal_case_notes").insert({
      case_id: caseId,
      kind: "court",
      note: `${first ? "Court" : "Moved to"} ${name}${ref.trim() ? ` · Ref. ${ref.trim()}` : ""}${from ? ` from ${d(from)}` : ""}`,
    });
    void logActivity({
      module: "Case Desk",
      action: "update",
      entityType: "legal_case",
      entityId: caseId,
      entityLabel: caseNumber,
      details: { court: name, reference_no: ref, from_date: from },
    });
    toast.success("Court history updated");
    setAdding(false);
    setCourtId("");
    setCourtName("");
    setRef("");
    setNote("");
    q.refetch();
    onChanged();
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Landmark className="h-4 w-4 text-primary" /> Court & reference history
        </div>
        {canEdit && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
            {first ? "Add court" : "Change court / new reference"}
          </Button>
        )}
      </div>
      {adding && (
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2">
          <CreatableSelect
            value={courtId}
            label={courtName || null}
            options={courtOptions(m.data?.courts ?? [])}
            onChange={(v) => {
              setCourtId(v);
              setCourtName("");
              const c = m.data?.courts.find((x) => x.id === v);
              if (c?.state) setState(c.state);
            }}
            onCreate={(t) => {
              setCourtId("");
              setCourtName(t);
            }}
            placeholder="Court / authority"
          />
          <Input placeholder="Reference / case no. in this court" value={ref} onChange={(e) => setRef(e.target.value)} />
          <SearchSelect
            value={state}
            onChange={setState}
            placeholder="State"
            options={(m.data?.states ?? []).map((s) => ({ value: s, label: s }))}
          />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input
            className="sm:col-span-2"
            placeholder={first ? "Note (optional)" : "Reason, e.g. transferred by order dated …"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" data-no-confirm="true" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={cn("rounded-md px-2 py-1.5 text-xs", r.is_current ? "bg-primary/10" : "bg-muted/40")}
          >
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium text-foreground">{r.court_name}</span>
              {r.is_current && (
                <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">Current</span>
              )}
              {i === rows.length - 1 && rows.length > 1 && (
                <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">First</span>
              )}
            </div>
            <div className="text-muted-foreground">
              Ref. {r.reference_no || "—"} · {r.state || "—"} · from {d(r.from_date)}
              {r.note ? ` · ${r.note}` : ""}
            </div>
          </li>
        ))}
        {!q.isLoading && rows.length === 0 && (
          <li className="text-xs text-muted-foreground">No court recorded yet.</li>
        )}
      </ol>
    </div>
  );
}
