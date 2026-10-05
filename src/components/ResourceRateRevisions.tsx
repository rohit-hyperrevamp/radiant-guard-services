import { Fragment, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Edit2, GitCompare, History, Loader2, X } from "lucide-react";
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
  const [compareExpiredId, setCompareExpiredId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [applicableFrom, setApplicableFrom] = useState("");
  const [applicableTill, setApplicableTill] = useState(contractEndDate);

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
  const comparedExpired = history.find((r) => r.id === compareExpiredId) ?? null;
  const comparisonBase = useMemo(
    () => (comparedExpired ? revToResource(resource, comparedExpired) : resource),
    [comparedExpired, resource],
  );
  const comparisonTarget = comparedExpired ? resource : draftResource;

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
    void logActivity({ module: "Contract Rate Card", action: "create", entityType: "contract_rate_revisions", entityId: resource.id, entityLabel: `${label} revised rate` });
    toast.success("Revised rate copy created — edit the wages, then review and approve.");
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
    void logActivity({ module: "Contract Rate Card", action: "update", entityType: "contract_rate_revisions", entityId: draft.id, entityLabel: `${label} revised rate` });
    toast.success("Revised rate saved");
    setEditOpen(false);
    void load();
  }

  async function discard() {
    if (!draft) return;
    const confirmed = await confirmAction({
      title: "Discard revised rate?",
      description: "This revised rate and all changes made to it will be permanently discarded. The present rate will remain unchanged.",
      confirmText: "Discard revised rate",
      cancelText: "Keep revised rate",
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
    void logActivity({ module: "Contract Rate Card", action: "delete", entityType: "contract_rate_revisions", entityId: draft.id, entityLabel: `${label} revised rate` });
    toast.success("Revised rate discarded");
    void load();
  }

  async function approve() {
    if (!draft || !applicableFrom || !applicableTill) return toast.error("Choose both applicable dates");
    if (applicableTill < applicableFrom) return toast.error("Applicable till cannot be before applicable from");
    const confirmed = await confirmAction({
      title: "Approve revised rate?",
      description: `The revised rate will apply from ${fmtDate(applicableFrom)} till ${fmtDate(applicableTill)}. The present rate will end on the previous day, and earlier payroll and invoices will remain unchanged.`,
      confirmText: "Approve revised rate",
      cancelText: "Cancel",
      tone: "success",
    });
    if (!confirmed) return;
    setBusy(true);
    const { error } = await supabase.rpc("approve_contract_rate_revision" as never, {
      _id: draft.id,
      _effective_from: applicableFrom,
      _effective_to: applicableTill,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Contract Rate Card", action: "approve", entityType: "contract_rate_revisions", entityId: draft.id, entityLabel: label, details: { effectiveFrom: applicableFrom, effectiveTo: applicableTill } });
    toast.success(
      applicableFrom <= todayIso()
        ? `Revised rate approved from ${fmtDate(applicableFrom)} till ${fmtDate(applicableTill)}`
        : `Revised rate approved — applies automatically from ${fmtDate(applicableFrom)} till ${fmtDate(applicableTill)}`,
    );
    setApproveOpen(false);
    setCompareOpen(false);
    void load();
  }

  // Comparison rows by item name across wages, deductions, employer cost.
  const compareRows = (() => {
    if (!comparisonTarget) return [];
    const groups: [string, { name?: string; amount?: unknown }[], { name?: string; amount?: unknown }[]][] = [
      ["Wages", comparisonBase.components, comparisonTarget.components],
      ["Deductions", comparisonBase.deductions, comparisonTarget.deductions],
      ["Employer cost", comparisonBase.employerContributions, comparisonTarget.employerContributions],
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
          Present rate: {fmtDate(active?.effective_from ?? contractStartDate ?? null)} – {fmtDate(active?.effective_to ?? contractEndDate ?? null)}
        </span>
        {scheduled && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-400">
            Revised rate approved · {fmtDate(scheduled.effective_from)} – {fmtDate(scheduled.effective_to)} ({fmt(sum(scheduled.components) + sum(scheduled.employer_contributions))})
          </span>
        )}
        {!draft && canEdit && (
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-[11px]" disabled={busy} onClick={createCopy}>
            <Copy className="mr-1 h-3 w-3" /> Copy as revised rate
          </Button>
        )}
      </div>

      {history.length > 0 && (
        <div className="space-y-1.5">
          {history.map((expiredRate) => {
            const expiredResource = revToResource(resource, expiredRate);
            return (
              <div key={expiredRate.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Expired</span>
                <span className="font-medium tabular-nums">{fmt(billing(expiredResource))}</span>
                <span className="text-muted-foreground">
                  {fmtDate(expiredRate.effective_from ?? contractStartDate ?? null)} – {fmtDate(expiredRate.effective_to)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-[11px]"
                  onClick={() => {
                    setCompareExpiredId(expiredRate.id);
                    setCompareOpen(true);
                  }}
                >
                  <GitCompare className="mr-1 h-3 w-3" /> Compare with present
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {draft && draftResource && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-rate-revised px-2 py-0.5 text-[11px] font-semibold text-rate-revised-foreground">Revised rate</span>
              <span className="text-muted-foreground">Not used until approved</span>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setCompareExpiredId(null); setCompareOpen(true); }}>
              <GitCompare className="mr-1 h-3 w-3" /> Review present vs revised
            </Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">
               Present <span className="text-rate-present-foreground">{fmt(billing(resource))}</span>
               {" → "}Revised <span className="text-rate-revised-foreground">{fmt(billing(draftResource))}</span>
            </span>
            <span className="text-muted-foreground">
              Present rate: {fmtDate(active?.effective_from ?? contractStartDate ?? null)} – {fmtDate(active?.effective_to ?? contractEndDate ?? null)}
               {" · "}Revised rate: {applicableFrom && applicableTill ? `${fmtDate(applicableFrom)} – ${fmtDate(applicableTill)}` : "dates set on approval"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canEdit && (
              <>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditOpen(true)}>
                  <Edit2 className="mr-1 h-3 w-3" /> Edit new rate
                </Button>
                 <Button type="button" size="sm" className="h-7 text-[11px]" onClick={() => { setApplicableFrom(""); setApplicableTill(contractEndDate); setApproveOpen(true); }}>
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

      <Dialog open={compareOpen} onOpenChange={(open) => { setCompareOpen(open); if (!open) setCompareExpiredId(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label} — {comparedExpired ? "Expired rate vs Present rate" : "Present rate vs Revised rate"}</DialogTitle>
            <DialogDescription>
              {comparedExpired
                ? `The previous rate expired on ${fmtDate(comparedExpired.effective_to)}. Monthly amounts are retained for historical comparison.`
                : "Monthly amounts. The revised rate is not used until approved."}
            </DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs">
                <th className="py-1.5 font-semibold text-muted-foreground">Item</th>
                <th className={`px-2 py-2 text-right ${comparedExpired ? "bg-muted/50" : "bg-rate-present text-rate-present-foreground"}`}>
                  <div className="font-bold">{comparedExpired ? "Expired Rate" : "Present Rate"}</div>
                  <div className="text-[10px] font-normal opacity-80">
                    {comparedExpired
                      ? `${fmtDate(comparedExpired.effective_from ?? contractStartDate)} – ${fmtDate(comparedExpired.effective_to)}`
                      : `${fmtDate(active?.effective_from ?? contractStartDate)} – ${fmtDate(active?.effective_to ?? contractEndDate)}`}
                  </div>
                </th>
                <th className={`px-2 py-2 text-right ${comparedExpired ? "bg-rate-present text-rate-present-foreground" : "bg-rate-revised text-rate-revised-foreground"}`}>
                  <div className="font-bold">{comparedExpired ? "Present Rate" : "Revised Rate"}</div>
                  <div className="text-[10px] font-normal opacity-80">
                    {comparedExpired
                      ? `${fmtDate(active?.effective_from ?? contractStartDate)} – ${fmtDate(active?.effective_to ?? contractEndDate)}`
                      : applicableFrom && applicableTill
                        ? `${fmtDate(applicableFrom)} – ${fmtDate(applicableTill)}`
                        : `${fmtDate(contractStartDate)} – ${fmtDate(contractEndDate)}`}
                  </div>
                </th>
                <th className="py-1.5 text-right font-semibold text-muted-foreground">Change</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((g) => (
                <Fragment key={g.group}>
                  <tr><td colSpan={4} className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</td></tr>
                  {g.lines.map((l) => (
                    <tr key={g.group + l.name} className="border-b border-border/50">
                      <td className="py-1">{l.name}</td>
                       <td className={`px-2 py-1.5 text-right tabular-nums ${comparedExpired ? "bg-muted/30" : "bg-rate-present/70 text-rate-present-foreground"}`}>{fmt(l.cur)}</td>
                       <td className={`px-2 py-1.5 text-right tabular-nums ${comparedExpired ? "bg-rate-present/70 text-rate-present-foreground" : "bg-rate-revised/70 text-rate-revised-foreground"}`}>{fmt(l.nxt)}</td>
                      <td className={`py-1 text-right tabular-nums ${l.nxt - l.cur > 0 ? "text-emerald-600" : l.nxt - l.cur < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {l.nxt - l.cur === 0 ? "—" : fmt(l.nxt - l.cur)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {comparisonTarget && (
                <tr className="font-semibold">
                  <td className="pt-3">Monthly billing</td>
                   <td className={`px-2 py-3 text-right tabular-nums ${comparedExpired ? "bg-muted/30" : "bg-rate-present text-rate-present-foreground"}`}>{fmt(billing(comparisonBase))}</td>
                   <td className={`px-2 py-3 text-right tabular-nums ${comparedExpired ? "bg-rate-present text-rate-present-foreground" : "bg-rate-revised text-rate-revised-foreground"}`}>{fmt(billing(comparisonTarget))}</td>
                  <td className="pt-3 text-right tabular-nums">{fmt(billing(comparisonTarget) - billing(comparisonBase))}</td>
                </tr>
              )}
            </tbody>
          </table>
          {canEdit && !comparedExpired && (
            <DialogFooter>
               <Button type="button" onClick={() => { setApplicableFrom(""); setApplicableTill(contractEndDate); setApproveOpen(true); }}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve revised rate
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve revised rate</DialogTitle>
            <DialogDescription>
              The revised rate applies to payroll and invoices only within this date range. Earlier days stay on the present rate, which becomes expired the day before.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Applicable from</Label>
              <Input type="date" value={applicableFrom} min={contractStartDate} max={applicableTill || contractEndDate} onChange={(e) => setApplicableFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Applicable till</Label>
              <Input type="date" value={applicableTill} min={applicableFrom || contractStartDate} max={contractEndDate} onChange={(e) => setApplicableTill(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
             <Button type="button" disabled={busy || !applicableFrom || !applicableTill || applicableTill < applicableFrom} onClick={approve}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
