import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Inbox,
  PackageCheck,
  Shirt,
  UserCheck,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { cn } from "@/lib/utils";

type StockRow = { item_id: string; size_value: string; qty: number };
type ItemRow = { id: string; name: string; item_code: string };

type InventorySummary = {
  stock: Array<StockRow & { name: string; code: string }>;
  demandCount: number;
  openDemandCount: number;
  issuanceCount: number;
  pendingReceiptCount: number;
  guardsWithStock: number;
  collectionQty: number;
};

const EMPTY_SUMMARY: InventorySummary = {
  stock: [],
  demandCount: 0,
  openDemandCount: 0,
  issuanceCount: 0,
  pendingReceiptCount: 0,
  guardsWithStock: 0,
  collectionQty: 0,
};

export function FieldOfficerInventoryDashboard() {
  const role = useCurrentUserRole();
  const summaryQ = useQuery({
    queryKey: ["field-officer-inventory-workspace", role.userId, role.candidateId],
    enabled: role.isFieldOfficer && !!role.userId && !!role.candidateId,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<InventorySummary> => {
      const candidateId = role.candidateId;
      const userId = role.userId;
      if (!candidateId || !userId) return EMPTY_SUMMARY;

      const [stockRes, demandsRes, sourceIssRes, destinationIssRes, guardsRes] = await Promise.all([
        supabase
          .from("inv_stock_balances" as never)
          .select("item_id,size_value,qty")
          .eq("location_type", "field_officer")
          .eq("location_id", candidateId)
          .gt("qty", 0),
        supabase
          .from("inv_demands" as never)
          .select("id,status")
          .eq("requester_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("inv_issuances" as never)
          .select("id,status")
          .eq("source_type", "field_officer")
          .eq("source_id", candidateId),
        supabase
          .from("inv_issuances" as never)
          .select("id,status")
          .eq("destination_type", "field_officer")
          .eq("destination_id", candidateId),
        supabase
          .from("candidates" as never)
          .select("id")
          .eq("reports_to", candidateId)
          .in("role_key", ["guard", "security_guard"])
          .eq("status", "active"),
      ]);

      for (const result of [stockRes, demandsRes, sourceIssRes, destinationIssRes, guardsRes]) {
        if (result.error) throw result.error;
      }

      const stockRows = ((stockRes.data ?? []) as unknown as StockRow[])
        .map((row) => ({ ...row, qty: Number(row.qty) }))
        .filter((row) => row.qty > 0);
      const itemIds = Array.from(new Set(stockRows.map((row) => row.item_id)));
      let itemRows: ItemRow[] = [];
      if (itemIds.length) {
        const { data, error } = await supabase
          .from("inv_items" as never)
          .select("id,name,item_code")
          .in("id", itemIds);
        if (error) throw error;
        itemRows = (data ?? []) as unknown as ItemRow[];
      }
      const itemMap = new Map(itemRows.map((item) => [item.id, item]));
      const stock = stockRows
        .map((row) => ({
          ...row,
          name: itemMap.get(row.item_id)?.name ?? "Inventory item",
          code: itemMap.get(row.item_id)?.item_code ?? "",
        }))
        .filter((row) => /uniform|shoe/i.test(`${row.name} ${row.code}`))
        .sort((a, b) => a.name.localeCompare(b.name) || a.size_value.localeCompare(b.size_value));

      const guardIds = ((guardsRes.data ?? []) as unknown as Array<{ id: string }>).map((row) => row.id);
      let guardBalances: Array<{ location_id: string; qty: number }> = [];
      if (guardIds.length) {
        const { data, error } = await supabase
          .from("inv_stock_balances" as never)
          .select("location_id,qty")
          .in("location_type", ["guard", "security_guard"])
          .in("location_id", guardIds)
          .gt("qty", 0);
        if (error) throw error;
        guardBalances = (data ?? []) as unknown as Array<{ location_id: string; qty: number }>;
      }

      const demands = (demandsRes.data ?? []) as unknown as Array<{ id: string; status: string }>;
      const sourceIssuances = (sourceIssRes.data ?? []) as unknown as Array<{ id: string; status: string }>;
      const destinationIssuances = (destinationIssRes.data ?? []) as unknown as Array<{ id: string; status: string }>;
      return {
        stock,
        demandCount: demands.length,
        openDemandCount: demands.filter((row) => !["fulfilled", "cancelled", "rejected"].includes(row.status)).length,
        issuanceCount: sourceIssuances.length,
        pendingReceiptCount: destinationIssuances.filter((row) => row.status === "issued").length,
        guardsWithStock: new Set(guardBalances.map((row) => row.location_id)).size,
        collectionQty: guardBalances.reduce((total, row) => total + Number(row.qty || 0), 0),
      };
    },
  });

  const summary = summaryQ.data ?? EMPTY_SUMMARY;
  const totalQty = summary.stock.reduce((total, row) => total + row.qty, 0);
  const uniformQty = summary.stock.filter((row) => /uniform/i.test(`${row.name} ${row.code}`)).reduce((total, row) => total + row.qty, 0);
  const shoeQty = summary.stock.filter((row) => /shoe/i.test(`${row.name} ${row.code}`)).reduce((total, row) => total + row.qty, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Uniform Manager" description="Your stock, requests, issuances and collections." crumbs={[{ label: "Uniform Manager" }]} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile label="Total inventory" value={summaryQ.isLoading ? "—" : totalQty} hint={`${summary.stock.length} size lines`} icon={Boxes} tone="blue" />
        <SummaryTile label="Uniforms" value={summaryQ.isLoading ? "—" : uniformQty} hint="Available with you" icon={Shirt} tone="mint" />
        <SummaryTile label="Shoes" value={summaryQ.isLoading ? "—" : shoeQty} hint="Available with you" icon={PackageCheck} tone="violet" />
      </section>

      {summary.pendingReceiptCount > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><CheckCircle2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">{summary.pendingReceiptCount} delivery {summary.pendingReceiptCount === 1 ? "confirmation" : "confirmations"} pending</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Confirm the delivery challan to add received stock to your inventory.</p>
          </div>
          <Button asChild size="sm"><Link to="/admin/inventory/goods-receipts">Confirm receipt</Link></Button>
        </section>
      )}

      <section>
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Workflows</div>
          <h2 className="mt-1 text-xl font-bold text-foreground">Manage inventory</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <WorkflowTile title="My stock" value={totalQty} hint="Uniforms and shoes held by you" icon={Boxes} to="/admin/my-inventory" tone="blue" />
          <WorkflowTile title="Demands" value={summary.openDemandCount} hint={`${summary.demandCount} total requests`} icon={ClipboardList} to="/admin/inventory/demands" tone="lime" />
          <WorkflowTile title="Issuances" value={summary.issuanceCount} hint="Issue stock to your guards" icon={UserCheck} to="/admin/inventory/issuances" tone="violet" />
          <WorkflowTile title="Collections" value={summary.guardsWithStock} hint={`${summary.collectionQty} items held by guards`} icon={Inbox} to="/admin/inventory/collections" tone="rose" />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div>
            <h2 className="text-sm font-medium text-foreground">Stock with me</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Live quantity by product and size</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/admin/my-inventory">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        {summaryQ.isError ? (
          <div className="px-4 py-10 text-center text-sm text-destructive">Couldn’t load your inventory. Please retry.</div>
        ) : summaryQ.isLoading ? (
          <div className="space-y-2 p-4"><div className="h-11 animate-pulse rounded-lg bg-muted" /><div className="h-11 animate-pulse rounded-lg bg-muted" /></div>
        ) : summary.stock.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No Uniform or Shoe stock is currently held by you.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {summary.stock.map((row) => (
               <div key={`${row.item_id}-${row.size_value}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                 <div className="min-w-0"><div className="line-clamp-2 text-sm font-medium text-foreground">{row.name}</div><div className="mt-0.5 text-xs text-muted-foreground">Size {row.size_value || "Standard"}</div></div>
                 <span className="rounded-lg bg-secondary px-2.5 py-1 text-sm font-medium tabular-nums text-foreground sm:px-3 sm:py-1.5">{row.qty}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({ label, value, hint, icon: Icon, tone }: { label: string; value: number | string; hint: string; icon: React.ComponentType<{ className?: string }>; tone: "blue" | "mint" | "violet" }) {
  const surface = { blue: "bg-[rgb(var(--tint-blue))]", mint: "bg-[rgb(var(--tint-emerald))]", violet: "bg-[rgb(var(--tint-violet))]" }[tone];
  return <div className={cn("flex min-h-[96px] items-center justify-between gap-2 rounded-xl border border-border/50 p-3 shadow-sm sm:min-h-[112px] sm:gap-3 sm:rounded-2xl sm:p-4", surface)}><div><div className="text-[11px] font-medium text-muted-foreground">{label}</div><div className="mt-1.5 text-2xl font-medium whitespace-nowrap tabular-nums leading-none text-foreground sm:mt-2 sm:text-3xl">{value}</div><div className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">{hint}</div></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card/80 text-primary sm:h-10 sm:w-10 sm:rounded-xl"><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></span></div>;
}

function WorkflowTile({ title, value, hint, icon: Icon, to, tone }: { title: string; value: number; hint: string; icon: React.ComponentType<{ className?: string }>; to: "/admin/my-inventory" | "/admin/inventory/demands" | "/admin/inventory/issuances" | "/admin/inventory/collections"; tone: "blue" | "lime" | "violet" | "rose" }) {
  const surface = { blue: "bg-[rgb(var(--tint-blue))]", lime: "bg-[rgb(var(--tint-amber))]", violet: "bg-[rgb(var(--tint-violet))]", rose: "bg-[rgb(var(--tint-rose))]" }[tone];
  return <Link to={to} className={cn("group relative flex min-h-[104px] flex-col justify-between rounded-xl border border-border/50 p-3 shadow-sm transition hover:border-primary/35 hover:shadow-md sm:min-h-[126px] sm:rounded-2xl sm:p-4", surface)}><div className="flex items-start justify-between gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-card/80 text-primary sm:h-9 sm:w-9 sm:rounded-xl"><Icon className="h-4 w-4" /></span><ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-0.5" /></div><div><div className="flex items-end justify-between gap-2"><span className="text-sm font-medium text-foreground">{title}</span><span className="text-xl font-medium tabular-nums leading-none text-foreground sm:text-2xl">{value}</span></div><div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground sm:text-[11px]">{hint}</div></div></Link>;
}