import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/SearchSelect";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { confirmAction } from "@/components/ConfirmProvider";
import {
  ResourceFormDialog,
  type BenefitItem,
  type ContractResource,
  type ResourceComponent,
} from "@/routes/admin.contracts.client-contracts";

export const Route = createFileRoute("/admin/contracts/bulk-rate-revision")({
  head: () => ({
    meta: [
      { title: "Bulk Rate Revision | Radiant Guard Services" },
      { name: "description", content: "Revise the rate structure of many client contracts at once." },
      { property: "og:title", content: "Bulk Rate Revision | Radiant Guard Services" },
      { property: "og:description", content: "Revise the rate structure of many client contracts at once." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkRateRevisionPage,
});

type Line = {
  resource: ContractResource;
  contractId: string;
  contractCode: string;
  contractStart: string | null;
  contractEnd: string | null;
  unitName: string;
  unitCode: string;
  state: string;
  designation: string;
  hasDraft: boolean;
  draftId: string | null;
};

type Client = {
  contractId: string;
  contractCode: string;
  unitName: string;
  unitCode: string;
  state: string;
  designations: string[];
};

const sum = (a: { amount?: unknown }[] | undefined) => (a ?? []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
const billing = (r: ContractResource) => sum(r.components) + sum(r.employerContributions);
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Structure fingerprint, order-independent. */
const signature = (r: ContractResource) => {
  const norm = (a: { name?: string; amount?: unknown }[]) =>
    a.map((c) => [c.name ?? "", Number(c.amount) || 0] as const).sort((x, y) => x[0].localeCompare(y[0]));
  return JSON.stringify([
    norm(r.components), norm(r.benefits), norm(r.deductions), norm(r.employerContributions),
    r.payrollDayBaseId, r.billingDayBaseId, r.shiftHours,
  ]);
};
const PAGE = 50;

/** Plain-language list of what differs between the reference (a) and another client (b). */
function diffReasons(a: ContractResource, b: ContractResource, refName: string): string[] {
  const out: string[] = [];
  const groups: [string, { name?: string; amount?: unknown }[], { name?: string; amount?: unknown }[]][] = [
    ["wage component", a.components, b.components],
    ["benefit", a.benefits, b.benefits],
    ["deduction", a.deductions, b.deductions],
    ["employer contribution", a.employerContributions, b.employerContributions],
  ];
  for (const [label, x, y] of groups) {
    const mx = new Map(x.map((c) => [c.name ?? "", Number(c.amount) || 0]));
    const my = new Map(y.map((c) => [c.name ?? "", Number(c.amount) || 0]));
    for (const [n, v] of mx) {
      if (!my.has(n)) out.push(`Does not have the ${label} "${n}" that ${refName} has`);
      else if (my.get(n) !== v) out.push(`${n} is ${fmt(my.get(n)!)} here, but ${fmt(v)} in ${refName}`);
    }
    for (const n of my.keys()) if (!mx.has(n)) out.push(`Has an extra ${label} "${n}" that ${refName} does not have`);
  }
  if (a.payrollDayBaseId !== b.payrollDayBaseId) out.push("Uses a different payroll days basis");
  if (a.billingDayBaseId !== b.billingDayBaseId) out.push("Uses a different billing days basis");
  if (a.shiftHours !== b.shiftHours) out.push(`Shift is ${b.shiftHours ?? "-"} hours here, but ${a.shiftHours ?? "-"} hours in ${refName}`);
  if (billing(a) !== billing(b)) out.push(`Total contract value is ${fmt(billing(b))} here, but ${fmt(billing(a))} in ${refName}`);
  return out;
}

function BulkRateRevisionPage() {
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState("");
  const [stateName, setStateName] = useState("");
  const [groupKey, setGroupKey] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [till, setTill] = useState("2026-12-01");

  const canEdit = useQuery({
    queryKey: ["can-edit-contract-rates"],
    queryFn: async () => (await supabase.rpc("current_user_can_edit_contract_rates" as never)).data === true,
  });

  const orgs = useQuery({
    queryKey: ["bulk-rr-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers" as never).select("id,name,code").order("name").limit(2000);
      if (error) throw error;
      return (data as unknown as Array<{ id: string; name: string; code: string | null }>) ?? [];
    },
  });

  const lines = useQuery({
    queryKey: ["bulk-rr-lines", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Line[]> => {
      const { data: units, error: ue } = await supabase
        .from("units" as never)
        .select("id,name,code,client_state,billing_state")
        .eq("customer_id", orgId)
        .limit(2000);
      if (ue) throw ue;
      const unitList = (units as unknown as Array<{ id: string; name: string; code: string; client_state: string | null; billing_state: string | null }>) ?? [];
      if (!unitList.length) return [];
      const unitById = new Map(unitList.map((u) => [u.id, u]));
      const { data: contracts, error: ce } = await supabase
        .from("client_contracts" as never)
        .select("id,unit_id,contract_code,start_date,end_date")
        .in("unit_id", unitList.map((u) => u.id))
        .eq("status", "active")
        .eq("approval_status", "approved")
        .limit(2000);
      if (ce) throw ce;
      const cList = (contracts as unknown as Array<{ id: string; unit_id: string; contract_code: string; start_date: string | null; end_date: string | null }>) ?? [];
      if (!cList.length) return [];
      const cById = new Map(cList.map((c) => [c.id, c]));
      const ids = cList.map((c) => c.id);
      const [res, desigs, drafts] = await Promise.all([
        supabase
          .from("contract_resources" as never)
          .select("id,contract_id,designation_id,role_key,service_type_id,quantity,shift_hours,components,payroll_day_base_id,billing_day_base_id,benefits,deductions,employer_contributions")
          .in("contract_id", ids)
          .limit(5000),
        supabase.from("designations" as never).select("id,name").limit(2000),
        supabase.from("contract_rate_revisions" as never).select("id,resource_id").in("contract_id", ids).eq("status", "new_rate").limit(5000),
      ]);
      if (res.error) throw res.error;
      const dName = new Map(((desigs.data as unknown as Array<{ id: string; name: string }>) ?? []).map((d) => [d.id, d.name]));
      const draftBy = new Map(((drafts.data as unknown as Array<{ id: string; resource_id: string }>) ?? []).map((d) => [d.resource_id, d.id]));
      return ((res.data as unknown as Record<string, unknown>[]) ?? []).map((r) => {
        const c = cById.get(String(r.contract_id))!;
        const u = unitById.get(c.unit_id)!;
        return {
          resource: {
            id: String(r.id),
            designationId: r.designation_id ? String(r.designation_id) : "",
            roleKey: r.role_key ? String(r.role_key) : null,
            serviceTypeId: r.service_type_id ? String(r.service_type_id) : "",
            quantity: Number(r.quantity ?? 1),
            shiftHours: Number(r.shift_hours ?? 8) === 12 ? 12 : 8,
            components: Array.isArray(r.components) ? (r.components as ResourceComponent[]) : [],
            payrollDayBaseId: r.payroll_day_base_id ? String(r.payroll_day_base_id) : null,
            billingDayBaseId: r.billing_day_base_id ? String(r.billing_day_base_id) : null,
            benefits: Array.isArray(r.benefits) ? (r.benefits as BenefitItem[]) : [],
            deductions: Array.isArray(r.deductions) ? (r.deductions as BenefitItem[]) : [],
            employerContributions: Array.isArray(r.employer_contributions) ? (r.employer_contributions as BenefitItem[]) : [],
          },
          contractId: c.id,
          contractCode: c.contract_code,
          contractStart: c.start_date,
          contractEnd: c.end_date,
          unitName: u.name,
          unitCode: u.code,
          state: u.client_state || u.billing_state || "",
          designation: r.designation_id ? dName.get(String(r.designation_id)) ?? "—" : "—",
          hasDraft: draftBy.has(String(r.id)),
          draftId: draftBy.get(String(r.id)) ?? null,
        } as Line;
      });
    },
  });

  const all = lines.data ?? [];
  const states = useMemo(() => Array.from(new Set(all.map((l) => l.state).filter(Boolean))).sort(), [all]);

  // Categories: same designation + identical rate structure, within the chosen state.
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; designation: string; lines: Line[] }>();
    for (const l of all) {
      if (stateName && l.state !== stateName) continue;
      const key = `${l.designation}::${signature(l.resource)}`;
      const g = m.get(key) ?? { key, designation: l.designation, lines: [] };
      if (!g.lines.some((x) => x.contractId === l.contractId)) g.lines.push(l);
      m.set(key, g);
    }
    const list = Array.from(m.values());
    list.forEach((g) => g.lines.sort((a, b) => a.unitName.localeCompare(b.unitName)));
    return list.sort((a, b) => a.designation.localeCompare(b.designation) || b.lines.length - a.lines.length);
  }, [all, stateName]);

  const ql = q.toLowerCase();
  const visibleGroups = groups.filter(
    (g) => !ql || g.designation.toLowerCase().includes(ql) || g.lines.some((l) => `${l.unitName} ${l.unitCode} ${l.contractCode}`.toLowerCase().includes(ql)),
  );
  const multi = visibleGroups.filter((g) => g.lines.length > 1);
  const single = visibleGroups.filter((g) => g.lines.length === 1);

  const active = groups.find((g) => g.key === groupKey) ?? null;
  const chosen = active ? active.lines.filter((l) => selected.has(l.resource.id)) : [];
  const template = chosen[0] ?? active?.lines[0] ?? null;
  const designation = active?.designation ?? "";

  const pickGroup = (key: string) => {
    const g = groups.find((x) => x.key === key);
    setGroupKey(key);
    setSelected(new Set(g?.lines.map((l) => l.resource.id) ?? []));
    setRevised(null);
  };
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const [revised, setRevised] = useState<ContractResource | null>(null);

  async function applyRevised(r: ContractResource) {
    setEditOpen(false);
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const l of chosen) {
      const payload = {
        gross: sum(r.components),
        components: r.components,
        benefits: r.benefits,
        deductions: r.deductions,
        employer_contributions: r.employerContributions,
        payroll_day_base_id: r.payrollDayBaseId,
        billing_day_base_id: r.billingDayBaseId,
        shift_hours: r.shiftHours,
      };
      const res = l.draftId
        ? await supabase.from("contract_rate_revisions" as never).update({ ...payload, updated_at: new Date().toISOString() } as never).eq("id", l.draftId)
        : await supabase.from("contract_rate_revisions" as never).insert({ ...payload, contract_id: l.contractId, resource_id: l.resource.id, status: "new_rate" } as never);
      if (res.error) errors.push(`${l.unitName}: ${res.error.message}`);
      else ok++;
    }
    setBusy(false);
    setRevised(r);
    void logActivity({ module: "Contract Rate Card", action: "create", entityType: "contract_rate_revisions", entityLabel: `Bulk revised rate (${ok} lines, ${designation})` });
    if (errors.length) toast.error(`${errors.length} failed — ${errors[0]}`);
    toast.success(`Revised rate saved for ${ok} client${ok === 1 ? "" : "s"}. Set dates and approve below.`);
    await qc.invalidateQueries({ queryKey: ["bulk-rr-lines", orgId] });
  }

  async function approveAll() {
    if (!from || !till || till < from) return toast.error("Choose a valid applicable from / till range");
    const fresh = ((await qc.fetchQuery({ queryKey: ["bulk-rr-lines", orgId] })) as Line[]).filter(
      (l) => selected.has(l.resource.id) && l.draftId,
    );
    if (!fresh.length) return toast.error("No revised rates to approve — create them first");
    const ok = await confirmAction({
      title: `Approve ${fresh.length} revised rates?`,
      description: `They apply from ${from} till ${till} (or each contract's end date if earlier). Present rates end the day before. Earlier payroll and invoices stay unchanged.`,
      confirmText: "Approve all",
      cancelText: "Cancel",
      tone: "success",
    });
    if (!ok) return;
    setBusy(true);
    let done = 0;
    const errors: string[] = [];
    for (const l of fresh) {
      const t = l.contractEnd && l.contractEnd < till ? l.contractEnd : till;
      const { error } = await supabase.rpc("approve_contract_rate_revision" as never, { _id: l.draftId, _effective_from: from, _effective_to: t } as never);
      if (error) errors.push(`${l.unitName}: ${error.message}`);
      else done++;
    }
    setBusy(false);
    void logActivity({ module: "Contract Rate Card", action: "approve", entityType: "contract_rate_revisions", entityLabel: `Bulk approved ${done} revised rates`, details: { effectiveFrom: from, effectiveTo: till } });
    if (errors.length) toast.error(`${errors.length} not approved — ${errors[0]}`);
    if (done) toast.success(`${done} revised rate${done === 1 ? "" : "s"} approved`);
    setRevised(null);
    await qc.invalidateQueries({ queryKey: ["bulk-rr-lines", orgId] });
  }

  const draftsSelected = chosen.filter((l) => l.hasDraft).length;

  const GroupCard = ({ g }: { g: (typeof groups)[number] }) => {
    const r = g.lines[0].resource;
    const isActive = g.key === groupKey;
    return (
      <div className={`rounded-xl border p-3 ${isActive ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{g.designation}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{g.lines.length} client{g.lines.length === 1 ? "" : "s"}</span>
          <span className="text-sm text-muted-foreground">Present rate {fmt(billing(r))} · {r.shiftHours}h shift</span>
          <Button size="sm" variant={isActive ? "default" : "outline"} className="ml-auto" onClick={() => (isActive ? setGroupKey("") : pickGroup(g.key))}>
            {isActive ? "Selected" : "Select this category"}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {g.lines.map((l) => (
            <label key={l.resource.id} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
              {isActive && <input type="checkbox" checked={selected.has(l.resource.id)} onChange={() => toggle(l.resource.id)} />}
              <span className="font-medium">{l.unitName}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{l.contractCode}</span>
              {l.hasDraft && <span className="rounded-full bg-rate-revised px-1.5 text-[10px] text-rate-revised-foreground">Revised</span>}
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk Rate Revision"
        eyebrow="Contracts"
        description="Clients are grouped into categories with the same designation and identical rate structure. Select a category and revise its rate together."
        crumbs={[{ label: "Contracts" }, { label: "Bulk Rate Revision" }]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/contracts/client-contracts"><ArrowLeft className="mr-1 h-4 w-4" /> Contracts</Link>
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <SearchSelect
          value={orgId}
          onChange={(v) => { setOrgId(v); setStateName(""); setGroupKey(""); setSelected(new Set()); }}
          options={(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.code ?? undefined }))}
          placeholder="Select organization"
          searchPlaceholder="Search organization…"
          emptyText="No organization found."
        />
        <SearchSelect
          value={stateName}
          onChange={(v) => { setStateName(v); setGroupKey(""); setSelected(new Set()); }}
          disabled={!orgId}
          options={[{ value: "", label: "All states" }, ...states.map((s) => ({ value: s, label: s }))]}
          placeholder="All states"
          searchPlaceholder="Search state…"
          emptyText="No state found."
        />
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search client or designation" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {active && (
        <div className="sticky top-2 z-10 space-y-3 rounded-xl border border-accent/40 bg-background p-3 text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{designation}</span>
            <span className="text-muted-foreground">{chosen.length} of {active.lines.length} clients selected · present rate {template ? fmt(billing(template.resource)) : "—"}</span>
            {canEdit.data && (
              <Button size="sm" className="ml-auto" disabled={busy || !chosen.length} onClick={() => setEditOpen(true)}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Copy className="mr-1 h-4 w-4" />} Copy present & revise
              </Button>
            )}
          </div>
          {revised && template && (
            <div className="text-xs text-muted-foreground">
              Revised rate {fmt(billing(revised))} (change {fmt(billing(revised) - billing(template.resource))}) saved, not used until approved.
            </div>
          )}
          {canEdit.data && draftsSelected > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Applicable from</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Applicable till</Label>
                <Input type="date" value={till} min={from} onChange={(e) => setTill(e.target.value)} />
              </div>
              <Button disabled={busy || !from || !till} onClick={approveAll}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve {draftsSelected} revised rate{draftsSelected === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </div>
      )}

      {!orgId && <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">Select an organization to see its rate categories.</div>}
      {orgId && lines.isLoading && <div className="p-6 text-center text-muted-foreground">Loading…</div>}
      {orgId && !lines.isLoading && !visibleGroups.length && <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">No active contracts match.</div>}

      {multi.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Categories with matching rates ({multi.length})</h3>
          {multi.map((g) => <GroupCard key={g.key} g={g} />)}
        </section>
      )}
      {single.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Unique rate — no other client matches ({single.length})</h3>
          {single.map((g) => <GroupCard key={g.key} g={g} />)}
        </section>
      )}

      {editOpen && template && (
        <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} initial={template.resource} onSubmit={applyRevised} />
      )}
    </div>
  );
}
