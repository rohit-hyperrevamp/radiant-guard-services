import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Loader2, Search } from "lucide-react";
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
  const [designation, setDesignation] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
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
  const clients = useMemo(() => {
    const m = new Map<string, Client>();
    for (const l of all) {
      const c = m.get(l.contractId) ?? { contractId: l.contractId, contractCode: l.contractCode, unitName: l.unitName, unitCode: l.unitCode, state: l.state, designations: [] };
      if (!c.designations.includes(l.designation)) c.designations.push(l.designation);
      m.set(l.contractId, c);
    }
    return Array.from(m.values()).sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [all]);
  const states = useMemo(() => Array.from(new Set(clients.map((c) => c.state).filter(Boolean))).sort(), [clients]);
  const selClients = clients.filter((c) => selected.has(c.contractId));

  // Designations present in EVERY selected client.
  const common = useMemo(() => {
    if (!selClients.length) return [] as string[];
    let s = new Set(selClients[0].designations);
    for (const c of selClients.slice(1)) s = new Set(c.designations.filter((d) => s.has(d)));
    return Array.from(s).sort();
  }, [selClients]);

  // Smart filter: once clients are selected, only show clients that share a
  // common designation whose rate structure matches the first selected client.
  const compatibleIds = useMemo(() => {
    if (!selClients.length) return null;
    const set = new Set<string>();
    for (const c of clients) {
      if (selected.has(c.contractId)) {
        set.add(c.contractId);
        continue;
      }
      for (const d of common) {
        const tl = all.find((l) => l.contractId === selClients[0].contractId && l.designation === d);
        const cl = all.find((l) => l.contractId === c.contractId && l.designation === d);
        if (tl && cl && signature(tl.resource) === signature(cl.resource)) {
          set.add(c.contractId);
          break;
        }
      }
    }
    return set;
  }, [selClients, clients, common, all, selected]);

  const filtered = clients
    .filter((c) => !compatibleIds || compatibleIds.has(c.contractId))
    .filter((c) => !stateName || c.state === stateName)
    .filter((c) => !q || `${c.unitName} ${c.unitCode} ${c.contractCode}`.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);

  useEffect(() => {
    if (designation && !common.includes(designation)) setDesignation("");
    if (!designation && common.length === 1) setDesignation(common[0]);
  }, [common, designation]);

  const chosen = designation ? all.filter((l) => selected.has(l.contractId) && l.designation === designation) : [];
  const template = chosen[0] ?? null;
  const mismatches = template
    ? chosen
        .filter((l) => signature(l.resource) !== signature(template.resource))
        .map((l) => ({ line: l, reasons: diffReasons(template.resource, l.resource, template.unitName) }))
    : [];
  const differing = mismatches.length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.contractId));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allFilteredSelected) filtered.forEach((c) => n.delete(c.contractId));
      else filtered.forEach((c) => n.add(c.contractId));
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
      (l) => selected.has(l.contractId) && l.designation === designation && l.draftId,
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
  const rateFor = (c: Client) => {
    if (!designation) return null;
    const l = all.find((x) => x.contractId === c.contractId && x.designation === designation);
    return l ?? null;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk Rate Revision"
        eyebrow="Contracts"
        description="Pick an organization and state, select clients, choose a designation they all have, and revise its rate together."
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
          onChange={(v) => {
            setOrgId(v);
            setStateName("");
            setDesignation("");
            setSelected(new Set());
            setPage(0);
          }}
          options={(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.code ?? undefined }))}
          placeholder="Select organization"
          searchPlaceholder="Search organization…"
          emptyText="No organization found."
        />
        <SearchSelect
          value={stateName}
          onChange={(v) => {
            setStateName(v);
            setPage(0);
          }}
          disabled={!orgId}
          options={[{ value: "", label: "All states" }, ...states.map((s) => ({ value: s, label: s }))]}
          placeholder="All states"
          searchPlaceholder="Search state…"
          emptyText="No state found."
        />
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search client" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
      </div>

      {selClients.length > 0 && (
        <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{selClients.length} client{selClients.length === 1 ? "" : "s"} selected</span>
            <div className="w-64">
              <SearchSelect
                value={designation}
                onChange={setDesignation}
                disabled={!common.length}
                options={common.map((d) => ({ value: d, label: d }))}
                placeholder={common.length ? "Choose common designation" : "No common designation"}
                searchPlaceholder="Search designation…"
                emptyText="No designation found."
              />
            </div>
            {template && <span className="text-muted-foreground">Present rate {fmt(billing(template.resource))}</span>}
            {canEdit.data && (
              <Button
                size="sm"
                className="ml-auto"
                disabled={busy || !template || differing > 0}
                onClick={() => setEditOpen(true)}
              >
                <Copy className="mr-1 h-4 w-4" /> Copy present & revise
              </Button>
            )}
          </div>

          {!common.length && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">These clients have no designation in common.</div>
                <div className="text-xs">Bulk revision works for a designation (e.g. Security Guard) that every selected client has. Unselect the clients that don't have it.</div>
              </div>
            </div>
          )}
          {common.length > 0 && !designation && (
            <div className="text-xs text-muted-foreground">Only designations that all selected clients have are shown. Pick one to continue.</div>
          )}

          {differing > 0 && template && (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">
                    {differing} of {chosen.length} clients have a different {designation} rate, so they can't be revised together.
                  </div>
                  <div className="text-xs">
                    Each one is compared with <b>{template.unitName}</b> (present rate {fmt(billing(template.resource))}). Unselect them to continue, or revise them separately.
                  </div>
                </div>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto">
                {mismatches.map(({ line, reasons }) => (
                  <div key={line.resource.id} className="rounded-md border border-destructive/30 bg-background p-2 text-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{line.unitName}</b>
                      <span className="font-mono text-[11px] text-muted-foreground">{line.contractCode}</span>
                      <span className="text-xs text-muted-foreground">Present rate {fmt(billing(line.resource))}</span>
                      <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => toggle(line.contractId)}>Unselect</Button>
                    </div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                      {(reasons.length ? reasons : ["Rate lines are set up differently"]).slice(0, 6).map((r, i) => <li key={i}>{r}</li>)}
                      {reasons.length > 6 && <li>…and {reasons.length - 6} more differences</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                Approve {draftsSelected} revised rate{draftsSelected === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </div>
      )}

      {compatibleIds && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          Showing only clients that share a common designation with the same rate structure as your selection. Clear the selection to see all clients again.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 p-2.5"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} disabled={!filtered.length} aria-label="Select all" /></th>
              <th className="p-2.5">Client</th>
              <th className="p-2.5">State</th>
              <th className="p-2.5">Contract</th>
              <th className="p-2.5">Designations</th>
              <th className="p-2.5 text-right">{designation ? `${designation} rate` : "Present rate"}</th>
              <th className="p-2.5">Revision</th>
            </tr>
          </thead>
          <tbody>
            {!orgId && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Select an organization to list its clients.</td></tr>}
            {lines.isLoading && orgId && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {orgId && !lines.isLoading && !filtered.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No active contracts match.</td></tr>}
            {shown.map((c) => {
              const l = rateFor(c);
              return (
                <tr key={c.contractId} className="border-t border-border">
                  <td className="p-2.5"><input type="checkbox" checked={selected.has(c.contractId)} onChange={() => toggle(c.contractId)} aria-label={`Select ${c.unitName}`} /></td>
                  <td className="p-2.5"><div className="font-medium">{c.unitName}</div><div className="font-mono text-[11px] text-muted-foreground">{c.unitCode}</div></td>
                  <td className="p-2.5">{c.state || "—"}</td>
                  <td className="p-2.5 font-mono text-xs">{c.contractCode}</td>
                  <td className="p-2.5 text-xs">{c.designations.join(", ")}</td>
                  <td className="p-2.5 text-right tabular-nums">{l ? fmt(billing(l.resource)) : "—"}</td>
                  <td className="p-2.5">{l?.hasDraft ? <span className="rounded-full bg-rate-revised px-2 py-0.5 text-[11px] text-rate-revised-foreground">Revised · awaiting approval</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {editOpen && template && (
        <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} initial={template.resource} onSubmit={applyRevised} />
      )}
    </div>
  );
}
