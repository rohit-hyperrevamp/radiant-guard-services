import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { IndianRupee, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/SearchSelect";
import { confirmAction } from "@/components/ConfirmProvider";
import { logActivity } from "@/lib/activity-log";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
export const MONEY_KINDS = [
  { value: "claim", label: "Amount claimed" },
  { value: "penalty", label: "Penalty / fine" },
  { value: "deposit", label: "Court deposit" },
  { value: "advocate_fee", label: "Advocate fee" },
  { value: "court_fee", label: "Court / filing fee" },
  { value: "settlement", label: "Settlement" },
  { value: "compensation", label: "Compensation awarded" },
  { value: "recovery", label: "Recovery" },
  { value: "other", label: "Other expense" },
];
const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "received", label: "Received" },
  { value: "waived", label: "Waived / not applicable" },
];
type Row = {
  id: string;
  kind: string;
  direction: string;
  amount: number;
  entry_on: string;
  status: string;
  notes: string | null;
};
const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const lbl = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

/** Money tracking per case: claims, penalties, deposits, fees, settlements — payable by us or receivable. */
export function CaseMoney({
  caseId,
  caseNumber,
  canEdit,
  canDelete,
}: {
  caseId: string;
  caseNumber: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const key = ["legal-case-money", caseId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db
        .from("legal_case_money")
        .select("*")
        .eq("case_id", caseId)
        .order("entry_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const blank = { kind: "claim", direction: "payable", amount: "", entry_on: new Date().toISOString().slice(0, 10), status: "pending", notes: "" };
  const [f, setF] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = q.data ?? [];
  const sum = (pred: (r: Row) => boolean) => rows.filter(pred).reduce((a, r) => a + Number(r.amount), 0);
  const tot = {
    claimed: sum((r) => r.kind === "claim"),
    penalties: sum((r) => r.kind === "penalty"),
    spent: sum((r) => r.direction === "payable" && r.status === "paid"),
    received: sum((r) => r.direction === "receivable" && r.status === "received"),
    pending: sum((r) => r.status === "pending" && r.kind !== "claim"),
  };

  const save = async () => {
    if (!f) return;
    const amount = Number(f.amount);
    if (!(amount > 0)) return toast.error("Enter an amount");
    setBusy(true);
    const payload = { case_id: caseId, ...f, amount, notes: f.notes || null };
    const { error } = await db.from("legal_case_money").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logActivity({
      module: "Case Desk",
      action: "create",
      entityType: "legal_case_money",
      entityLabel: `${caseNumber} · ${lbl(MONEY_KINDS, f.kind)} ${inr(amount)}`,
      after: payload,
    });
    setF(null);
    qc.invalidateQueries({ queryKey: key });
  };

  const setStatus = async (r: Row, status: string) => {
    const { error } = await db.from("legal_case_money").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logActivity({
      module: "Case Desk",
      action: "update",
      entityType: "legal_case_money",
      entityLabel: `${caseNumber} · ${lbl(MONEY_KINDS, r.kind)} ${inr(r.amount)}`,
      before: { status: r.status },
      after: { status },
    });
    qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (r: Row) => {
    if (!(await confirmAction({ title: "Delete this money entry?", destructive: true }))) return;
    const { error } = await db.from("legal_case_money").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    await logActivity({
      module: "Case Desk",
      action: "delete",
      entityType: "legal_case_money",
      entityLabel: `${caseNumber} · ${lbl(MONEY_KINDS, r.kind)} ${inr(r.amount)}`,
      before: r,
    });
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <IndianRupee className="h-4 w-4" /> Money in this case
        </div>
        {canEdit && !f && (
          <Button size="sm" variant="outline" onClick={() => setF(blank)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add amount
          </Button>
        )}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Claimed", tot.claimed],
          ["Penalties", tot.penalties],
          ["Paid by us", tot.spent],
          ["Received", tot.received],
          ["Still pending", tot.pending],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-muted/40 p-2">
            <div className="text-[11px] text-muted-foreground">{l}</div>
            <div className="text-sm font-semibold tabular-nums text-foreground">{inr(v as number)}</div>
          </div>
        ))}
      </div>

      {f && (
        <div className="mb-3 grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
          <SearchSelect value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={MONEY_KINDS} />
          <SearchSelect
            value={f.direction}
            onChange={(v) => setF({ ...f, direction: v })}
            options={[
              { value: "payable", label: "We pay" },
              { value: "receivable", label: "We receive" },
            ]}
          />
          <Input type="number" placeholder="Amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Input type="date" value={f.entry_on} onChange={(e) => setF({ ...f, entry_on: e.target.value })} />
          <SearchSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUSES} />
          <Input placeholder="Note (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="flex gap-2 sm:col-span-3">
            <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setF(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {rows.length === 0 && !f ? (
        <p className="text-xs text-muted-foreground">No amounts recorded yet.</p>
      ) : (
        <div className="divide-y divide-border text-xs">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">
                  {lbl(MONEY_KINDS, r.kind)} · {inr(r.amount)}
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({r.direction === "receivable" ? "we receive" : "we pay"})
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {format(new Date(r.entry_on), "dd MMM yyyy")}
                  {r.notes ? ` · ${r.notes}` : ""}
                </div>
              </div>
              {canEdit ? (
                <SearchSelect className="w-40" value={r.status} onChange={(v) => setStatus(r, v)} options={STATUSES} />
              ) : (
                <span className="text-muted-foreground">{lbl(STATUSES, r.status)}</span>
              )}
              {canDelete && (
                <button aria-label="Delete" onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
