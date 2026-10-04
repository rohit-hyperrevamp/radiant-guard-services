import { Fragment, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Edit2, GitCompare, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity-log";
import { confirmAction } from "@/components/ConfirmProvider";
import type { ContractResource } from "@/routes/admin.contracts.client-contracts";

type Rev = {
  id: string;
  contract_id: string;
  resource_id: string;
  status: "new_rate" | "approved" | "expired" | "discarded";
  effective_from: string | null;
  effective_to: string | null;
  components: ContractResource["components"];
  benefits: ContractResource["benefits"];
  deductions: ContractResource["deductions"];
  employer_contributions: ContractResource["employerContributions"];
  payroll_day_base_id: string | null;
  billing_day_base_id: string | null;
  shift_hours: number;
  promoted_at: string | null;
};

type EditorProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ContractResource | null;
  onSubmit: (r: ContractResource) => void;
};

const sum = (arr: { amount?: unknown }[] | undefined) =>
  (arr ?? []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
const fmt = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const todayIso = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

function revToResource(base: ContractResource, r: Rev): ContractResource {
  return {
    ...base,
    components: r.components ?? [],
    benefits: r.benefits ?? [],
    deductions: r.deductions ?? [],
    employerContributions: r.employer_contributions ?? [],
    payrollDayBaseId: r.payroll_day_base_id,
    billingDayBaseId: r.billing_day_base_id,
    shiftHours: r.shift_hours === 12 ? 12 : 8,
  };
}

export function ResourceRateRevisions({
  resource,
  label,
  canEdit,
  Editor,
  contractStartDate,
  contractEndDate,
}: {
  resource: ContractResource;
  label: string;
  canEdit: boolean;
  Editor: ComponentType<EditorProps>;
  contractStartDate: string;
  contractEndDate: string;
}) {
  const [revs, setRevs] = useState<Rev[]>([]);
  const [contractId, setContractId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [date, setDate] = useState("");

  const load = useCallback(async () => {
    if (!resource.id) return;
    const { data } = await supabase
      .from("contract_rate_revisions" as never)
      .select("*")
      .eq("resource_id", resource.id)
      .neq("status", "discarded")
      .order("effective_from", { ascending: false, nullsFirst: false });
    setRevs((data ?? []) as unknown as Rev[]);
    const { data: cr } = await supabase
      .from("contract_resources" as never)
      .select("contract_id")
      .eq("id", resource.id)
      .maybeSingle();
    setContractId(((cr as { contract_id?: string } | null)?.contract_id) ?? null);
  }, [resource.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const draft = revs.find((r) => r.status === "new_rate") ?? null;
  const scheduled = revs.find((r) => r.status === "approved" && !r.promoted_at) ?? null;
  const active = revs.find((r) => r.status === "approved" && r.promoted_at) ?? null;
  const history = revs.filter((r) => r.status === "expired");
  const draftResource = useMemo(() => (draft ? revToResource(resource, draft) : null), [draft, resource]);

  if (!resource.id) return null;

  const billing = (r: ContractResource) => sum(r.components) + sum(r.employerContributions);

  async function createCopy() {
    if (!contractId) return;
    setBusy(true);
    const gross = sum(resource.components);
    const { error } = await supabase.from("contract_rate_revisions" as never).insert({
      contract_id: contractId,
      resource_id: resource.id,
      status: "new_rate",
      gross,
      components: resource.components,
      benefits: resource.benefits,
      deductions: resource.deductions,
      employer_contributions: resource.employerContributions,
      payroll_day_base_id: resource.payrollDayBaseId,
      billing_day_base_id: resource.billingDayBaseId,
      shift_hours: resource.shiftHours,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Contract Rate Card", action: "create", entityType: "contract_rate_revisions", entityId: resource.id, entityLabel: `${label} new rate` });
    toast.success("New rate copy created — edit the wages, then review and approve.");
    void load();
  }

  async function saveDraft(r: ContractResource) {
    if (!draft) return;
    const { error } = await supabase
      .from("contract_rate_revisions" as never)
      .update({
        gross: sum(r.components),
        components: r.components,
        benefits: r.benefits,
        deductions: r.deductions,
        employer_contributions: r.employerContributions,
        payroll_day_base_id: r.payrollDayBaseId,
        billing_day_base_id: r.billingDayBaseId,
        shift_hours: r.shiftHours,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", draft.id);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Contract Rate Card", action: "update", entityType: "contract_rate_revisions", entityId: draft.id, entityLabel: `${label} new rate` });
    toast.success("New rate saved");
    setEditOpen(false);
    void load();
  }

  async function discard() {
    if (!draft) return;
    const confirmed = await confirmAction({
      title: "Discard new rate?",
      description: "This new rate and all changes made to it will be permanently discarded. The approved rate will remain unchanged.",
      confirmText: "Discard new rate",
      cancelText: "Keep new rate",
      destructive: true,
      tone: "warning",
    });
    if (!confirmed) return;
    setBusy(true);
    const { error } = await supabase
      .from("contract_rate_revisions" as never)
      .update({ status: "discarded" } as never)
      .eq("id", draft.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Contract Rate Card", action: "delete", entityType: "contract_rate_revisions", entityId: draft.id, entityLabel: `${label} new rate` });
    toast.success("New rate discarded");
    void load();
  }

  async function approve() {
    if (!draft || !date) return toast.error("Choose the applicable date");
    const confirmed = await confirmAction({
      title: "Approve new rate?",
      description: `The new rate will apply from ${fmtDate(date)}. The current approved rate will end on the previous day, and earlier payroll and invoices will remain unchanged.`,
      confirmText: "Approve new rate",
      cancelText: "Cancel",
      tone: "success",
    });
    if (!confirmed) return;
    setBusy(true);
    const { error } = await supabase.rpc("approve_contract_rate_revision" as never, {
      _id: draft.id,
      _effective_from: date,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Contract Rate Card", action: "approve", entityType: "contract_rate_revisions", entityId: draft.id, entityLabel: label, details: { effectiveFrom: date } });
    toast.success(
      date <= todayIso()
        ? `New rate approved and applicable from ${fmtDate(date)}`
        : `New rate approved — applies automatically from ${fmtDate(date)}`,
    );
    setApproveOpen(false);
    setCompareOpen(false);
    void load();
  }

  // Comparison rows by item name across wages, deductions, employer cost.
  const compareRows = (() => {
    if (!draftResource) return [];
    const groups: [string, { name?: string; amount?: unknown }[], { name?: string; amount?: unknown }[]][] = [
      ["Wages", resource.components, draftResource.components],
      ["Deductions", resource.deductions, draftResource.deductions],
      ["Employer cost", resource.employerContributions, draftResource.employerContributions],
    ];
    return groups.map(([g, a, b]) => {
      const names = Array.from(new Set([...a, ...b].map((x) => String(x.name ?? ""))));
      return {
        group: g,
        lines: names.map((n) => {
          const cur = Number(a.find((x) => x.name === n)?.amount) || 0;
          const nxt = Number(b.find((x) => x.name === n)?.amount) || 0;
          return { name: n, cur, nxt };
        }),
      };
    });
  })();

  return (
    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-muted-foreground">
          Current rate: {fmtDate(active?.effective_from ?? contractStartDate || null)} – {fmtDate(active?.effective_to ?? contractEndDate || null)}
        </span>
        {scheduled && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-400">
            Next rate approved · applies from {fmtDate(scheduled.effective_from)} ({fmt(sum(scheduled.components) + sum(scheduled.employer_contributions))})
          </span>
        )}
        {history.length > 0 && (
          <span className="text-muted-foreground" title={history.map((h) => `Expired ${fmtDate(h.effective_to)}: ${fmt(sum(h.components) + sum(h.employer_contributions))}`).join("\n")}>
            {history.length} expired rate{history.length > 1 ? "s" : ""}
          </span>
        )}
        {!draft && canEdit && (
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-[11px]" disabled={busy} onClick={createCopy}>
            <Copy className="mr-1 h-3 w-3" /> Copy as new rate
          </Button>
        )}
      </div>

      {draft && draftResource && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">New rate</span>
              <span className="text-muted-foreground">Not used until approved</span>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setCompareOpen(true)}>
              <GitCompare className="mr-1 h-3 w-3" /> Review current vs new
            </Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">
              Current {fmt(billing(resource))} → New {fmt(billing(draftResource))}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canEdit && (
              <>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditOpen(true)}>
                  <Edit2 className="mr-1 h-3 w-3" /> Edit new rate
                </Button>
                <Button type="button" size="sm" className="h-7 text-[11px]" onClick={() => { setDate(""); setApproveOpen(true); }}>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground hover:text-destructive" disabled={busy} onClick={discard}>
                  <X className="mr-1 h-3 w-3" /> Discard
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {editOpen && draftResource && (
        <Editor open={editOpen} onOpenChange={setEditOpen} initial={draftResource} onSubmit={saveDraft} />
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label} — Current vs New rate</DialogTitle>
            <DialogDescription>Monthly amounts. The new rate is not used until approved.</DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5">Item</th>
                <th className="py-1.5 text-right">Current (Approved)</th>
                <th className="py-1.5 text-right">New rate</th>
                <th className="py-1.5 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((g) => (
                <Fragment key={g.group}>
                  <tr><td colSpan={4} className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</td></tr>
                  {g.lines.map((l) => (
                    <tr key={g.group + l.name} className="border-b border-border/50">
                      <td className="py-1">{l.name}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(l.cur)}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(l.nxt)}</td>
                      <td className={`py-1 text-right tabular-nums ${l.nxt - l.cur > 0 ? "text-emerald-600" : l.nxt - l.cur < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {l.nxt - l.cur === 0 ? "—" : fmt(l.nxt - l.cur)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {draftResource && (
                <tr className="font-semibold">
                  <td className="pt-3">Monthly billing</td>
                  <td className="pt-3 text-right tabular-nums">{fmt(billing(resource))}</td>
                  <td className="pt-3 text-right tabular-nums">{fmt(billing(draftResource))}</td>
                  <td className="pt-3 text-right tabular-nums">{fmt(billing(draftResource) - billing(resource))}</td>
                </tr>
              )}
            </tbody>
          </table>
          {canEdit && (
            <DialogFooter>
              <Button type="button" onClick={() => { setDate(""); setApproveOpen(true); }}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve new rate
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve new rate</DialogTitle>
            <DialogDescription>
              From this date the new rate applies to payroll and invoices. Earlier days stay on the current rate, which becomes expired the day before.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Applicable from</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button type="button" disabled={busy || !date} onClick={approve}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
