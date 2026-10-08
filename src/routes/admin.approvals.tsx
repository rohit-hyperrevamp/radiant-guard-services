import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity-log";

type Search = { request?: string };
export const Route = createFileRoute("/admin/approvals")({
  validateSearch: (s: Record<string, unknown>): Search => ({ request: typeof s.request === "string" ? s.request : undefined }),
  head: () => ({ meta: [{ title: "Approvals — Radiant" }, { name: "description", content: "Review and decide approval requests." }] }),
  component: ApprovalsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Req = {
  id: string; workflow_key: string; entity_id: string | null; title: string; reason: string;
  payload: { changes?: Record<string, { from: unknown; to: unknown }> };
  requested_by: string | null; status: string; current_step: number; decided_by: string | null;
  decision_note: string; decided_at: string | null; created_at: string;
};
type Ev = { id: string; actor_id: string | null; step_order: number | null; action: string; note: string; created_at: string };
type Person = { id: string; full_name: string; employee_code: string | null; designation: string; department: string };

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name", date_of_birth: "Date of birth", aadhaar_number: "Aadhaar number", pan_number: "PAN number",
  bank_account_holder: "Account holder", bank_account_number: "Bank account number", bank_ifsc: "IFSC", bank_name: "Bank name",
  bank_branch: "Bank branch", bank_account_type: "Account type", aadhaar_image_url: "Aadhaar photo (front)",
  aadhaar_back_image_url: "Aadhaar photo (back)", pan_image_url: "PAN photo",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-accent text-accent-foreground", approved: "bg-primary text-primary-foreground",
  rejected: "bg-destructive text-destructive-foreground", cancelled: "bg-muted text-muted-foreground",
};
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

function ApprovalsPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"todo" | "mine" | "all">("todo");
  const [openId, setOpenId] = useState<string | undefined>(search.request);

  const meQ = useQuery({
    queryKey: ["approvals-me"],
    queryFn: async () => {
      const [c, all] = await Promise.all([db.rpc("current_user_candidate_id"), db.rpc("current_user_sees_all_approvals")]);
      return { me: (c.data as string) ?? null, all: !!all.data };
    },
  });
  const reqQ = useQuery({
    queryKey: ["approval-requests"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from("approval_requests").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });
  const stepsQ = useQuery({
    queryKey: ["approval-steps"],
    queryFn: async () => {
      const { data } = await db.from("workflow_steps").select("id,step_order,name,is_active,workflow_definitions!inner(key,name)");
      return (data ?? []) as Array<{ id: string; step_order: number; name: string; is_active: boolean; workflow_definitions: { key: string; name: string } }>;
    },
  });
  const canActQ = useQuery({
    queryKey: ["approval-can-act", meQ.data?.me, stepsQ.data?.length],
    enabled: !!meQ.data?.me && !!stepsQ.data,
    queryFn: async () => {
      const out = new Set<string>();
      await Promise.all((stepsQ.data ?? []).map(async (s) => {
        const { data } = await db.rpc("workflow_step_matches", { _step_id: s.id, _candidate: meQ.data!.me });
        if (data) out.add(`${s.workflow_definitions.key}:${s.step_order}`);
      }));
      return out;
    },
  });
  const ids = useMemo(() => {
    const s = new Set<string>();
    for (const r of reqQ.data ?? []) { if (r.requested_by) s.add(r.requested_by); if (r.entity_id) s.add(r.entity_id); if (r.decided_by) s.add(r.decided_by); }
    return [...s];
  }, [reqQ.data]);
  const peopleQ = useQuery({
    queryKey: ["approval-people", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await db.from("candidates").select("id,full_name,employee_code,designations(name),departments(name)").in("id", ids.slice(0, 300));
      return new Map(((data ?? []) as Array<{ id: string; full_name: string; employee_code: string | null; designations?: { name: string } | null; departments?: { name: string } | null }>)
        .map((p) => [p.id, { id: p.id, full_name: p.full_name, employee_code: p.employee_code, designation: p.designations?.name ?? "", department: p.departments?.name ?? "" } as Person]));
    },
  });
  const person = (id?: string | null) => (id ? peopleQ.data?.get(id) : undefined);
  const wfName = (k: string) => stepsQ.data?.find((s) => s.workflow_definitions.key === k)?.workflow_definitions.name ?? k.replace(/_/g, " ");
  const stepName = (k: string, o: number) => stepsQ.data?.find((s) => s.workflow_definitions.key === k && s.step_order === o)?.name ?? `Step ${o}`;
  const isSuper = !!meQ.data?.all;
  const canAct = (r: Req) => r.status === "pending" && r.requested_by !== meQ.data?.me &&
    (canActQ.data?.has(`${r.workflow_key}:${r.current_step}`) ?? false);

  const all = reqQ.data ?? [];
  const lists = {
    todo: all.filter(canAct),
    mine: all.filter((r) => r.requested_by === meQ.data?.me),
    all,
  };
  const rows = lists[tab];
  const current = all.find((r) => r.id === openId);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <PageHeader title="Approvals" description="Requests that need a decision. Who approves each step is set in Control Center → Workflow Manager." />
      <div className="flex flex-wrap gap-2">
        {([["todo", `Waiting for me (${lists.todo.length})`], ["mine", `My requests (${lists.mine.length})`], ...(isSuper || all.length ? [["all", `All (${all.length})`]] : [])] as Array<[typeof tab, string]>).map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{reqQ.isLoading ? "Loading…" : "Nothing here."}</div>
        ) : rows.map((r) => {
          const by = person(r.requested_by);
          return (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="flex w-full items-start justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-secondary/40">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {wfName(r.workflow_key)} · by {by?.full_name ?? "—"}{by?.department ? ` (${[by.designation, by.department].filter(Boolean).join(", ")})` : ""} · {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-foreground/70">{Object.keys(r.payload?.changes ?? {}).map((k) => FIELD_LABELS[k] ?? k).join(", ")}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[r.status] ?? ""}`}>{r.status}</span>
                {r.status === "pending" && <span className="text-xs text-muted-foreground">{stepName(r.workflow_key, r.current_step)}</span>}
              </div>
            </button>
          );
        })}
      </div>
      {current && (
        <RequestDialog req={current} canAct={canAct(current)} isRequester={current.requested_by === meQ.data?.me}
          person={person} wfName={wfName} stepName={stepName}
          onClose={() => setOpenId(undefined)} onChanged={() => qc.invalidateQueries({ queryKey: ["approval-requests"] })} />
      )}
    </div>
  );
}

function RequestDialog({ req: r, canAct, isRequester, person, wfName, stepName, onClose, onChanged }: {
  req: Req; canAct: boolean; isRequester: boolean; person: (id?: string | null) => Person | undefined;
  wfName: (k: string) => string; stepName: (k: string, o: number) => string; onClose: () => void; onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const evQ = useQuery({
    queryKey: ["approval-events", r.id, r.status, r.current_step],
    queryFn: async () => {
      const { data } = await db.from("approval_request_events").select("*").eq("request_id", r.id).order("created_at");
      return (data ?? []) as Ev[];
    },
  });
  const by = person(r.requested_by);
  const target = person(r.entity_id);
  const decide = async (decision: "approve" | "reject" | "cancel") => {
    setBusy(true);
    const { data, error } = await db.rpc("approval_decide", { _id: r.id, _decision: decision, _note: note.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    void logActivity({ module: "Approvals", action: decision, entityType: "approval_request", entityId: r.id, entityLabel: r.title, details: { note: note.trim(), result: data } });
    toast.success(data === "next_step" ? "Approved — sent to the next approver" : `Request ${data}`);
    onChanged(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{r.title}</DialogTitle>
          <DialogDescription>{wfName(r.workflow_key)} · {r.status === "pending" ? `Waiting at: ${stepName(r.workflow_key, r.current_step)}` : r.status}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-secondary/50 p-3">
              <div className="text-xs text-muted-foreground">Requested by</div>
              <div className="font-medium">{by?.full_name ?? "—"} {by?.employee_code ? `(${by.employee_code})` : ""}</div>
              <div className="text-xs text-muted-foreground">{[by?.designation, by?.department].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3">
              <div className="text-xs text-muted-foreground">For employee</div>
              <div className="font-medium">{target?.full_name ?? "—"} {target?.employee_code ? `(${target.employee_code})` : ""}</div>
              <div className="text-xs text-muted-foreground">{[target?.designation, target?.department].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          {r.reason && <div><span className="text-muted-foreground">Reason: </span>{r.reason}</div>}
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1 text-left">Field</th><th className="text-left">Now</th><th className="text-left">Change to</th></tr></thead>
            <tbody>
              {Object.entries(r.payload?.changes ?? {}).map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-1.5 font-medium">{FIELD_LABELS[k] ?? k}</td>
                  <td className="text-muted-foreground">{show(v.from)}</td>
                  <td className="font-medium text-foreground">{show(v.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</div>
            <ul className="space-y-1">
              {(evQ.data ?? []).map((e) => (
                <li key={e.id} className="text-xs"><Badge variant="secondary" className="mr-2">{e.action}</Badge>
                  {person(e.actor_id)?.full_name ?? "Someone"} · {new Date(e.created_at).toLocaleString()}{e.note ? ` — “${e.note}”` : ""}</li>
              ))}
            </ul>
          </div>
          {(canAct || (isRequester && r.status === "pending")) && (
            <Textarea placeholder="Message (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {isRequester && r.status === "pending" && <Button variant="ghost" disabled={busy} onClick={() => decide("cancel")}>Withdraw</Button>}
          {canAct && <Button variant="outline" disabled={busy} onClick={() => decide("reject")} className="gap-1"><XCircle className="h-4 w-4" /> Reject</Button>}
          {canAct && <Button disabled={busy} onClick={() => decide("approve")} className="gap-1"><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
