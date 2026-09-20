import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ClipboardList, Eye, Trash2, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { toast } from "sonner";
import { confirmAction, notifySaved } from "@/components/ConfirmProvider";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nextSeq, fmtNumber, statusBadgeClass } from "@/lib/inv-helpers";
import { useUserBranchScope } from "@/lib/use-user-branch-scope";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { useItemSizeOptions, sizePlaceholder, type ItemSizeOptions } from "@/lib/inv-sizes";
import { DataPagination, usePagination } from "@/components/DataPagination";
import { GuidedForm, useGuidedFormCloseGuard, type GuidedFormStep } from "@/components/GuidedForm";

export const Route = createFileRoute("/admin/inventory/demands")({ component: DemandsPage });

const MODULE = "Inventory Demands";
const ENTITY = "inv_demands";

type Demand = {
  id: string; demand_number: string; branch_id: string | null; warehouse_id: string | null; demand_date: string;
  status: string; notes: string; requester_id: string | null; requester_candidate_id: string | null;
  fulfillment_source?: "warehouse" | "branch";
};
type Branch = { id: string; name: string; code: string };
type Warehouse = { id: string; name: string; warehouse_code: string; is_default: boolean };
type Item = { id: string; name: string; item_code: string; is_sized: boolean };
type Line = { id?: string; item_id: string; size_value: string; requested_qty: number; fulfilled_qty: number };
type FieldScopeUnit = { unit_id: string; unit_name: string; unit_code: string; branch_id: string; is_primary: boolean };

function DemandsPage() {
  const qc = useQueryClient();
  const scope = useUserBranchScope();
  const role = useCurrentUserRole();
  const { data: fieldScope = [] } = useQuery({
    queryKey: ["inv", "field-officer-request-scope", role.candidateId],
    enabled: role.isFieldOfficer && !!role.candidateId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_field_scope" as never);
      if (error) throw error;
      return (data as unknown as FieldScopeUnit[]) ?? [];
    },
    staleTime: 60_000,
  });
  const primaryUnit = useMemo(
    () => fieldScope.find((unit) => unit.is_primary) ?? fieldScope[0] ?? null,
    [fieldScope],
  );

  const { data: demandsRaw = [] } = useQuery({
    queryKey: ["inv", "demands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inv_demands" as never).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Demand[]) ?? [];
    },
  });
  const demands = useMemo(
    () => (role.isFieldOfficer && role.userId
      ? demandsRaw.filter((d) => d.requester_id === role.userId)
      : demandsRaw),
    [demandsRaw, role.isFieldOfficer, role.userId],
  );
  const { data: branches = [] } = useQuery({
    queryKey: ["branches-list"],
    enabled: !role.isLoading && !role.isFieldOfficer,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches" as never).select("id,name,code").order("name");
      if (error) throw error;
      return (data as unknown as Branch[]) ?? [];
    },
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["inv", "warehouses-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inv_warehouses" as never).select("id,name,warehouse_code,is_default").eq("enabled", true).order("name");
      if (error) throw error;
      return (data as unknown as Warehouse[]) ?? [];
    },
  });
  const requestWarehouses = useMemo(
    () => role.isFieldOfficer ? warehouses.filter((warehouse) => warehouse.is_default) : warehouses,
    [role.isFieldOfficer, warehouses],
  );
  const { data: items = [] } = useQuery({
    queryKey: ["inv", "items-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inv_items" as never).select("id,name,item_code,is_sized").eq("enabled", true).order("name");
      if (error) throw error;
      return (data as unknown as Item[]) ?? [];
    },
  });
  const { data: sizeOptions = new Map<string, ItemSizeOptions>() } = useItemSizeOptions();


  const { data: lineAgg = new Map<string, { items: number; qty: number }>() } = useQuery({
    queryKey: ["inv", "demand-line-agg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inv_demand_lines" as never).select("demand_id,item_id,requested_qty");
      if (error) throw error;
      const rows = (data as unknown as { demand_id: string; item_id: string; requested_qty: number }[]) ?? [];
      const map = new Map<string, { items: Set<string>; qty: number }>();
      for (const r of rows) {
        const cur = map.get(r.demand_id) ?? { items: new Set<string>(), qty: 0 };
        cur.items.add(r.item_id);
        cur.qty += Number(r.requested_qty ?? 0);
        map.set(r.demand_id, cur);
      }
      const out = new Map<string, { items: number; qty: number }>();
      for (const [k, v] of map) out.set(k, { items: v.items.size, qty: v.qty });
      return out;
    },
  });

  const requesterIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of demands) if (d.requester_candidate_id) s.add(d.requester_candidate_id);
    return Array.from(s);
  }, [demands]);
  const { data: requesters = [] } = useQuery({
    queryKey: ["inv", "demand-requesters", requesterIds.join(",")],
    enabled: requesterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates" as never).select("id,full_name,role_key,employee_code").in("id", requesterIds);
      if (error) throw error;
      return (data as unknown as { id: string; full_name: string; role_key: string; employee_code: string | null }[]) ?? [];
    },
  });
  const requesterMap = useMemo(() => new Map(requesters.map((r) => [r.id, r])), [requesters]);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Demand | null>(null);
  const [viewing, setViewing] = useState<Demand | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") === "1") {
      setEditing(null);
      setOpen(true);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return demands;
    return demands.filter((d) => d.demand_number.toLowerCase().includes(q));
  }, [demands, query]);

  const pg = usePagination(filtered);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["inv", "demands"] });
    qc.invalidateQueries({ queryKey: ["inv", "demand-line-agg"] });
  };

  const deleteMut = useMutation({
    mutationFn: async (d: Demand) => {
      if (d.status !== "draft") throw new Error("Only drafts can be deleted.");
      const { error } = await supabase.from("inv_demands" as never).delete().eq("id", d.id);
      if (error) throw error;
      void logActivity({ module: MODULE, action: "delete", entityType: ENTITY, entityId: d.id, entityLabel: d.demand_number });
    },
    onSuccess: invalidate,
  });

  return (
    <div>
      <PageHeader title="Demands" description="Request stock from warehouse." crumbs={[{ label: "Uniform Manager", to: "/admin/inventory" }, { label: "Demands" }]} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search demand #…" className="h-10 rounded-lg pl-9" />
        </div>
        {scope.isScoped && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="h-10 rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" />New Demand
          </Button>
        )}
      </div>

      {/* Mobile card list */}
      <div className="space-y-2.5 lg:hidden">
        {pg.pageRows.map((d) => {
          const agg = lineAgg.get(d.id) ?? { items: 0, qty: 0 };
          const wh = d.warehouse_id ? warehouseMap.get(d.warehouse_id) : null;
          const br = d.branch_id ? branchMap.get(d.branch_id) : null;
          const destLabel = wh ? `${wh.name} (Warehouse)` : br ? `${br.code} – ${br.name}` : "—";
          const req = d.requester_candidate_id ? requesterMap.get(d.requester_candidate_id) : null;
          const reqLabel = req ? req.full_name : "—";
          const reqSub = req ? `${(req.role_key ?? "").replace(/_/g, " ")}${req.employee_code ? ` · ${req.employee_code}` : ""}` : "";
          return (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[13px] font-semibold text-foreground">{d.demand_number}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{d.demand_date}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadgeClass(d.status)}`}>
                  {d.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2.5 flex min-w-0 flex-col gap-2 text-[12px] min-[360px]:grid min-[360px]:grid-cols-2 min-[360px]:gap-x-3 min-[360px]:gap-y-1.5">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</div>
                  <div className="break-words text-foreground">{destLabel}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">By</div>
                  <div className="break-words font-medium text-foreground">{reqLabel}</div>
                  {reqSub && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{reqSub}</div>}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span><span className="font-semibold tabular-nums text-foreground">{agg.items}</span> items</span>
                  <span><span className="font-semibold tabular-nums text-foreground">{agg.qty}</span> qty</span>
                </div>
                <div className="inline-flex gap-1">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewing(d)}><Eye className="h-4 w-4" /></Button>
                  {d.status === "draft" && scope.isScoped && (
                    <>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setEditing(d); setOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={async () => {
                        if (!(await confirmAction({ title: "Delete demand?", description: `Delete ${d.demand_number}?`, confirmText: "Delete" }))) return;
                        try { await deleteMut.mutateAsync(d); toast.success("Deleted"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />No demands yet.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <div className="overflow-x-auto">
          <table className="ios-table w-full min-w-[820px] text-sm">

            <thead className="bg-secondary/60 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Demand #</th>
                <th className="px-5 py-3">Requested From</th>
                <th className="px-5 py-3">Requested By</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Items</th>
                <th className="px-5 py-3 text-right">Total Qty</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right" data-col="actions">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pg.pageRows.map((d) => {
                const agg = lineAgg.get(d.id) ?? { items: 0, qty: 0 };
                const wh = d.warehouse_id ? warehouseMap.get(d.warehouse_id) : null;
                const br = d.branch_id ? branchMap.get(d.branch_id) : null;
                const destLabel = wh ? `${wh.name} (Warehouse)` : br ? `${br.code} – ${br.name}` : "—";
                const req = d.requester_candidate_id ? requesterMap.get(d.requester_candidate_id) : null;
                const reqLabel = req ? req.full_name : "—";
                const reqSub = req ? `${(req.role_key ?? "").replace(/_/g, " ")}${req.employee_code ? ` · ${req.employee_code}` : ""}` : "";
                return (
                  <tr key={d.id} className="hover:bg-secondary/30">
                    <td className="px-5 py-3 font-mono text-xs" data-label="Demand #">{d.demand_number}</td>
                    <td className="px-5 py-3" data-label="Requested from">{destLabel}</td>
                    <td className="px-5 py-3" data-label="Requested by">
                      <div className="font-medium">{reqLabel}</div>
                      {reqSub && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{reqSub}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground" data-label="Date">{d.demand_date}</td>
                    <td className="px-5 py-3 text-right tabular-nums" data-label="Items">{agg.items}</td>
                    <td className="px-5 py-3 text-right tabular-nums" data-label="Total qty">{agg.qty}</td>
                    <td className="px-5 py-3" data-label="Status" data-col="status"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusBadgeClass(d.status)}`}>{d.status.replace("_", " ")}</span></td>
                    <td className="px-5 py-3 text-right" data-label="Actions" data-col="actions">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setViewing(d); }}><Eye className="h-4 w-4" /></Button>
                        {d.status === "draft" && scope.isScoped && (
                          <>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setEditing(d); setOpen(true); }}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={async () => {
                              if (!(await confirmAction({ title: "Delete demand?", description: `Delete ${d.demand_number}?`, confirmText: "Delete" }))) return;
                              try { await deleteMut.mutateAsync(d); toast.success("Deleted"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />No demands yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <DataPagination {...pg} />
      </div>


      <DemandFormDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        initial={editing}
        requesterCandidateId={role.candidateId}
        branchId={scope.branchId ?? ""}
        branchLabel={scope.branchLabel}
        isFieldOfficer={role.isFieldOfficer}
        branches={branches}
        warehouses={requestWarehouses}
        items={items}
        itemSizes={sizeOptions}
        primaryUnit={primaryUnit}

        onSaved={invalidate}
      />
      <DemandViewDialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} demand={viewing} items={items} />
    </div>
  );
}

function DemandFormDialog({ open, onOpenChange, initial, requesterCandidateId, branchId, branchLabel, isFieldOfficer, branches, warehouses, items, itemSizes, primaryUnit, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial: Demand | null;
  requesterCandidateId: string | null;
  branchId: string; branchLabel: string; isFieldOfficer: boolean;
  branches: Branch[]; warehouses: Warehouse[]; items: Item[]; itemSizes: Map<string, ItemSizeOptions>; onSaved: () => void;
  primaryUnit: FieldScopeUnit | null;
}) {

  const [demandDate, setDemandDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  // Source format: "wh:<warehouseId>" for warehouse-bound, "br:<branchId>" for branch-bound.
  const defaultWarehouseId = useMemo(
    () => warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "",
    [warehouses],
  );
  const defaultSource = isFieldOfficer && primaryUnit?.branch_id
    ? `br:${primaryUnit.branch_id}`
    : (defaultWarehouseId ? `wh:${defaultWarehouseId}` : "");
  const [source, setSource] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [stepKey, setStepKey] = useState("request");

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

  useResetOnOpen(open, async () => {
    if (initial) {
      setDemandDate(initial.demand_date);
      setNotes(initial.notes ?? "");
      if (initial.warehouse_id) {
        setSource(`wh:${initial.warehouse_id}`);
      } else if (initial.branch_id) {
        setSource(`br:${initial.branch_id}`);
      } else {
        setSource(defaultSource);
      }
      const { data } = await supabase.from("inv_demand_lines" as never).select("*").eq("demand_id", initial.id).order("sort_order");
      setLines(((data as unknown as Record<string, unknown>[]) ?? []).map((r) => ({
        id: String(r.id),
        item_id: String(r.item_id),
        size_value: String(r.size_value ?? ""),
        requested_qty: Number(r.requested_qty ?? 0),
        fulfilled_qty: Number(r.fulfilled_qty ?? 0),
      })));
    } else {
      setDemandDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setLines([]);
      setSource(defaultSource);
    }
    setStepKey("request");
  });

  const isWarehouse = source.startsWith("wh:");
  const targetWarehouseId = isWarehouse ? source.slice(3) : "";
  const targetBranchId = !isWarehouse && source.startsWith("br:") ? source.slice(3) : "";
  const sourceType = isWarehouse ? "warehouse" : "branch";
  const sourceId = isWarehouse ? targetWarehouseId : targetBranchId;
  const stockQuery = useQuery({
    queryKey: ["inv", "demand-source-stock", sourceType, sourceId],
    enabled: open && isFieldOfficer && !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inv_stock_balances" as never)
        .select("item_id,size_value,qty")
        .eq("location_type", sourceType)
        .eq("location_id", sourceId)
        .gt("qty", 0);
      if (error) throw error;
      return (data as unknown as Array<{ item_id: string; size_value: string; qty: number }>) ?? [];
    },
  });
  const sourceStock = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stockQuery.data ?? []) map.set(`${row.item_id}|${row.size_value}`, Number(row.qty));
    return map;
  }, [stockQuery.data]);
  // A field officer may only request what actually exists at the chosen source.
  // Nothing about the catalogue is hardcoded — availability drives the list.
  const requestItems = useMemo(() => {
    if (!isFieldOfficer) return items;
    if (!stockQuery.isSuccess) return items;
    const availableIds = new Set((stockQuery.data ?? []).map((row) => row.item_id));
    return items.filter((item) => availableIds.has(item.id));
  }, [isFieldOfficer, items, stockQuery.data, stockQuery.isSuccess]);

  // Pick a source as soon as one is known (base unit branch first, HQ second).
  useEffect(() => {
    if (!open || source || !defaultSource) return;
    setSource(defaultSource);
  }, [open, source, defaultSource]);

  useEffect(() => {
    if (!isFieldOfficer || !stockQuery.isSuccess) return;
    setLines((current) => current.filter((line) => requestItems.some((item) => item.id === line.item_id)));
  }, [isFieldOfficer, requestItems, source, stockQuery.isSuccess]);

  async function save(submit: boolean) {
    if (!source || (isWarehouse && !targetWarehouseId) || (!isWarehouse && !targetBranchId)) {
      toast.error("Choose where to send this demand"); return;
    }
    if (!lines.length || lines.some((l) => !l.item_id || l.requested_qty <= 0)) {
      toast.error("Add at least one item with quantity"); return;
    }
    if (isFieldOfficer) {
      const unavailable = lines.find((line) => line.requested_qty > (sourceStock.get(`${line.item_id}|${line.size_value}`) ?? 0));
      if (unavailable) {
        toast.error("Requested quantity exceeds the stock available at this source"); return;
      }
    }
    if (submit) {
      const missingSize = lines.find((l) => {
        const it = itemMap.get(l.item_id);
        return it?.is_sized && !String(l.size_value ?? "").trim();
      });
      if (missingSize) {
        const it = itemMap.get(missingSize.item_id);
        toast.error(`Select a size for ${it?.name ?? "the sized item"} before submitting`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const destFields = isWarehouse
        ? { warehouse_id: targetWarehouseId, branch_id: null, fulfillment_source: "warehouse" as const }
        : { warehouse_id: null, branch_id: targetBranchId, fulfillment_source: "branch" as const };
      let id = initial?.id;
      if (initial) {
        await supabase.from("inv_demands" as never).update({
          demand_date: demandDate, notes,
          ...destFields,
          status: submit ? "submitted" : "draft",
          submitted_at: submit ? new Date().toISOString() : null,
        } as never).eq("id", initial.id);
        await supabase.from("inv_demand_lines" as never).delete().eq("demand_id", initial.id);
      } else {
        const n = await nextSeq("inv_demand_number_seq");
        const number = fmtNumber("DM", n);
        const { data: ins, error } = await supabase.from("inv_demands" as never).insert({
          demand_number: number, demand_date: demandDate, notes,
          ...destFields,
          status: submit ? "submitted" : "draft",
          requester_id: user?.id ?? null,
          requester_candidate_id: requesterCandidateId,
          submitted_at: submit ? new Date().toISOString() : null,
        } as never).select("id,demand_number").single();
        if (error) throw error;
        id = (ins as unknown as { id: string }).id;
      }
      const payload = lines.map((l, idx) => ({
        demand_id: id, item_id: l.item_id, size_value: l.size_value,
        requested_qty: l.requested_qty, fulfilled_qty: 0, sort_order: idx,
      }));
      const { error: linesErr } = await supabase.from("inv_demand_lines" as never).insert(payload as never);
      if (linesErr) throw linesErr;
      await logActivity({ module: MODULE, action: submit ? "post" : (initial ? "update" : "create"), entityType: ENTITY, entityId: id!, entityLabel: initial?.demand_number ?? "Demand" });
       const destLabel = isWarehouse
        ? `${warehouseMap.get(targetWarehouseId)?.name ?? "warehouse"} (Warehouse)`
         : (primaryUnit?.branch_id === targetBranchId
           ? `${primaryUnit.unit_name} (${primaryUnit.unit_code})`
           : (branchMap.get(targetBranchId)?.name ?? "branch"));
      void notifySaved({ title: "Saved", description: submit ? `Demand submitted to ${destLabel}` : "Draft saved" });
      onSaved(); onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const submitLabel = isWarehouse
    ? `Submit to ${warehouseMap.get(targetWarehouseId)?.name ?? "Warehouse"}`
    : `Submit to ${primaryUnit?.branch_id === targetBranchId ? primaryUnit.unit_name : (branchMap.get(targetBranchId)?.name ?? "Branch")}`;
  const steps: GuidedFormStep[] = [
    { key: "request", label: "Request", caption: "Date and fulfilment source" },
    { key: "items", label: "Items", caption: "Products, sizes and quantities" },
    { key: "review", label: "Review", caption: "Check and submit the demand" },
  ];
  const validateStep = (key: string) => {
    if (key === "request" && !source) return "Choose where to send this demand";
    if (key === "items" && (!lines.length || lines.some((line) => !line.item_id || line.requested_qty <= 0))) return "Add at least one complete item";
    return null;
  };
  const isStepComplete = (key: string) => key === "review"
    ? !validateStep("request") && !validateStep("items")
    : !validateStep(key);
  const requestStep = (key: string) => {
    const target = steps.findIndex((step) => step.key === key);
    for (let index = 0; index < target; index += 1) {
      const problem = validateStep(steps[index].key);
      if (problem) { toast.error(problem); setStepKey(steps[index].key); return; }
    }
    setStepKey(key);
  };

  const closeGuard = useGuidedFormCloseGuard(() => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={closeGuard.onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-card p-0 sm:h-auto sm:max-h-[94dvh] sm:w-[96vw] sm:max-w-6xl sm:rounded-xl sm:border">
        <DialogHeader className="sr-only">
          <DialogTitle className="text-base sm:text-lg">{initial ? `Edit Demand ${initial.demand_number}` : "New Demand"}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{isFieldOfficer ? "Request available stock from your primary unit or Radiant Headquarters." : "Request stock from a warehouse. Submitting sends it to the warehouse team for fulfillment."}</DialogDescription>
        </DialogHeader>

        <GuidedForm closeGuardRef={closeGuard.ref} title={initial ? `Edit demand ${initial.demand_number}` : "New demand"} steps={steps} stepKey={stepKey} onStepChange={requestStep} isStepComplete={isStepComplete} onCancel={() => onOpenChange(false)} onSaveDraft={() => void save(false)} onSubmit={() => void save(true)} saving={saving} submitLabel={submitLabel}>
        <div className="modern-business-form space-y-5">
          <div className={stepKey === "request" ? "block" : "hidden"}>
          <section className="modern-form-section">
            <h3 className="modern-form-section-title">Request details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Demand Date</Label>
              <Input type="date" value={demandDate} onChange={(e) => setDemandDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Request From</Label>
              <Select value={source} onValueChange={(v) => setSource(v)}>
                <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choose source" /></SelectTrigger>
                <SelectContent>
                   {isFieldOfficer && primaryUnit?.branch_id && (
                     <SelectItem value={`br:${primaryUnit.branch_id}`}>{primaryUnit.unit_name} ({primaryUnit.unit_code}) · Primary</SelectItem>
                   )}
                  {warehouses.map((w) => (
                     <SelectItem key={`wh-${w.id}`} value={`wh:${w.id}`}>{w.name}{isFieldOfficer ? " · Secondary" : " (Warehouse)"}</SelectItem>
                  ))}
                   {!isFieldOfficer && branches.map((b) => (
                     <SelectItem key={`br-${b.id}`} value={`br:${b.id}`}>{b.name}{b.code ? ` (${b.code})` : ""}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
              {!isFieldOfficer && <p className="text-[11px] text-muted-foreground break-words">From branch: <span className="font-medium">{branchLabel}</span></p>}
            </div>
          </div>
          </section>
          </div>

          <div className={stepKey === "items" ? "block" : "hidden"}>
          <section className="modern-form-section">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Items</Label>
              <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { item_id: "", size_value: "", requested_qty: 1, fulfilled_qty: 0 }])}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add line
              </Button>
            </div>

            {/* Mobile: stacked cards */}
            <div className="grid gap-2 sm:hidden">
              {lines.map((l, idx) => {
                const it = itemMap.get(l.item_id);
                const sizeOpt = it ? itemSizes.get(it.id) : undefined;
                const sizes = sizeOpt?.options ?? [];
                const needsSize = !!it?.is_sized;
                const missing = needsSize && !String(l.size_value ?? "").trim();
                return (
                  <div key={idx} className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Line {idx + 1}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[11px] font-semibold">Item</Label>
                       <Select value={l.item_id} onValueChange={(v) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, item_id: v, size_value: "" } : x))}>
                        <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Pick item" /></SelectTrigger>
                         <SelectContent>{requestItems.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1.5 min-w-0">
                        <Label className="text-[11px] font-semibold">Size</Label>
                        {needsSize && sizes.length > 0 ? (
                          <Select value={l.size_value} onValueChange={(v) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, size_value: v } : x))}>
                            <SelectTrigger className={`h-10 w-full ${missing ? "border-destructive ring-1 ring-destructive/40" : ""}`}><SelectValue placeholder={sizePlaceholder(sizeOpt)} /></SelectTrigger>
                             <SelectContent>{sizes.filter((s) => !isFieldOfficer || sourceStock.has(`${l.item_id}|${s}`)).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className={`h-10 ${missing ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                            disabled={!needsSize}
                            value={l.size_value}
                            onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, size_value: e.target.value } : x))}
                            placeholder={needsSize ? "Required" : "—"}
                          />
                        )}
                      </div>
                      <div className="grid gap-1.5 min-w-0">
                        <Label className="text-[11px] font-semibold">Qty</Label>
                        <Input type="number" min={0} className="h-10 text-right" value={l.requested_qty} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, requested_qty: Number(e.target.value) || 0 } : x))} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!lines.length && <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No lines yet. Tap “Add line”.</div>}
            {isFieldOfficer && stockQuery.isSuccess && requestItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-center text-xs text-amber-700">
                Nothing is in stock at this source right now — switch the source on the previous step.
              </div>
            )}
            </div>

            {/* Tablet/desktop: original table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
              <table className="ios-table w-full text-sm">
                <thead className="bg-secondary/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 w-20">Size</th>
                    <th className="px-3 py-2 w-28 text-right">Requested Qty</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l, idx) => {
                    const it = itemMap.get(l.item_id);
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1.5">
                           <Select value={l.item_id} onValueChange={(v) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, item_id: v, size_value: "" } : x))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Pick item" /></SelectTrigger>
                             <SelectContent>{requestItems.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          {(() => {
                            const sizeOpt = it ? itemSizes.get(it.id) : undefined;
                const sizes = sizeOpt?.options ?? [];
                            const needsSize = !!it?.is_sized;
                            const missing = needsSize && !String(l.size_value ?? "").trim();
                            if (needsSize && sizes.length > 0) {
                              return (
                                <Select value={l.size_value} onValueChange={(v) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, size_value: v } : x))}>
                                  <SelectTrigger className={`h-9 ${missing ? "border-destructive ring-1 ring-destructive/40" : ""}`}><SelectValue placeholder={sizePlaceholder(sizeOpt)} /></SelectTrigger>
                                   <SelectContent>{sizes.filter((s) => !isFieldOfficer || sourceStock.has(`${l.item_id}|${s}`)).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              );
                            }
                            return (
                              <Input
                                className={`h-9 ${missing ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                                disabled={!needsSize}
                                value={l.size_value}
                                onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, size_value: e.target.value } : x))}
                                placeholder={needsSize ? "Required (e.g. M / L / 40)" : "—"}
                              />
                            );
                          })()}
                        </td>

                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} className="h-9 text-right" value={l.requested_qty} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, requested_qty: Number(e.target.value) || 0 } : x))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!lines.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">No lines yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          </section>
          </div>

          <div className={stepKey === "review" ? "space-y-5" : "hidden"}>
          <section className="modern-form-section">
            <h3 className="modern-form-section-title">Demand summary</h3>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Date</dt><dd className="mt-1 font-medium">{demandDate}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Requested from</dt><dd className="mt-1 font-medium">{isWarehouse ? warehouseMap.get(targetWarehouseId)?.name : branchMap.get(targetBranchId)?.name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Items</dt><dd className="mt-1 font-medium">{lines.length}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Total quantity</dt><dd className="mt-1 font-medium">{lines.reduce((sum, line) => sum + line.requested_qty, 0)}</dd></div>
            </dl>
          </section>
          <div className="grid gap-1.5"><Label className="text-xs font-semibold">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional message to warehouse" /></div>
          </div>
        </div>
        </GuidedForm>
      </DialogContent>
    </Dialog>

  );
}

function DemandViewDialog({ open, onOpenChange, demand, items }: {
  open: boolean; onOpenChange: (o: boolean) => void; demand: Demand | null; items: Item[];
}) {
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const { data: lines = [] } = useQuery({
    queryKey: ["inv", "demand-lines", demand?.id],
    enabled: !!demand,
    queryFn: async () => {
      if (!demand) return [];
      const { data, error } = await supabase.from("inv_demand_lines" as never).select("*").eq("demand_id", demand.id).order("sort_order");
      if (error) throw error;
      return (data as unknown as { id: string; item_id: string; size_value: string; requested_qty: number; fulfilled_qty: number }[]) ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Demand {demand?.demand_number}</DialogTitle>
          <DialogDescription>{demand?.demand_date} · <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusBadgeClass(demand?.status ?? "")}`}>{demand?.status?.replace("_", " ")}</span></DialogDescription>
        </DialogHeader>
          <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-border">
           <table className="ios-table w-full min-w-[480px] text-sm">
            <thead className="bg-secondary/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2 text-right">Requested</th>
                <th className="px-3 py-2 text-right">Fulfilled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 font-medium">{itemMap.get(l.item_id)?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{l.size_value || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(l.requested_qty)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{Number(l.fulfilled_qty)}</td>
                </tr>
              ))}
              {!lines.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">No items.</td></tr>}
            </tbody>
          </table>
        </div>
        {demand?.notes && <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm"><div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div><div className="mt-1">{demand.notes}</div></div>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useResetOnOpen(open: boolean, reset: () => void) {
  const [last, setLast] = useState(false);
  if (open !== last) { setLast(open); if (open) reset(); }
}
