import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";
import { useDropdownSearch } from "@/components/dropdown-search";

// ---------------------------------------------------------------------------
// Organization → Unit chain used whenever a contract is onboarded.
// Pick an existing organization or create one, then pick one of its units or
// create a new unit (site) under it. Contracts always live at unit level.
// ---------------------------------------------------------------------------

type Org = { id: string; code: string; name: string };
type Unit = { id: string; code: string; name: string; customer_id: string | null };
type Branch = { id: string; name: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).order("name").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

function nextCode(codes: string[], prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  for (const c of codes) {
    const m = c?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

export type OrgUnitValue = { customerId: string | null; unitId: string | null };

type NewOrg = { name: string; pan: string; gst: string; address: string; city: string; state: string; pincode: string };
type NewUnit = { name: string; address: string; city: string; state: string; pincode: string; branchId: string; latitude: string; longitude: string };

const emptyOrg: NewOrg = { name: "", pan: "", gst: "", address: "", city: "", state: "", pincode: "" };
const emptyUnit: NewUnit = { name: "", address: "", city: "", state: "", pincode: "", branchId: "", latitude: "", longitude: "" };

function Picker<T extends { id: string; code: string; name: string }>({
  items, value, onChange, placeholder, disabled,
}: { items: T[]; value: string | null; onChange: (id: string) => void; placeholder: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = items.find((i) => i.id === value);
  const options = useMemo(() => items.map((item) => ({ ...item, value: item.code, label: item.name })), [items]);
  const filtered = useDropdownSearch(options, q);
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled} className="h-10 w-full justify-between rounded-lg font-normal">
          {selected ? <span className="truncate"><span className="font-mono text-xs text-muted-foreground">{selected.code}</span> {selected.name}</span> : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by code or name…" value={q} onValueChange={setQ} />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((i) => (
                <CommandItem key={i.id} value={i.id} onSelect={() => { onChange(i.id); setOpen(false); setQ(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === i.id ? "opacity-100" : "opacity-0")} />
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{i.code}</span>
                  <span className="truncate">{i.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Controlled chain editor. Call `commit()` via the ref-less `useOrgUnitChain` hook. */
export function useOrgUnitChain(initial?: Partial<OrgUnitValue> & { orgName?: string; unitName?: string; city?: string; state?: string; pincode?: string; address?: string }) {
  const qc = useQueryClient();
  const orgsQ = useQuery({ queryKey: ["chain", "orgs"], queryFn: () => fetchAll<Org>("customers", "id,code,name") });
  const unitsQ = useQuery({ queryKey: ["chain", "units"], queryFn: () => fetchAll<Unit>("units", "id,code,name,customer_id") });
  const branchesQ = useQuery({ queryKey: ["chain", "branches"], queryFn: () => fetchAll<Branch & { code?: string }>("branches", "id,name") });

  const [orgMode, setOrgMode] = useState<"existing" | "new">(initial?.customerId ? "existing" : "existing");
  const [unitMode, setUnitMode] = useState<"existing" | "new">(initial?.unitId ? "existing" : "new");
  const [customerId, setCustomerId] = useState<string | null>(initial?.customerId ?? null);
  const [unitId, setUnitId] = useState<string | null>(initial?.unitId ?? null);
  const [org, setOrg] = useState<NewOrg>({ ...emptyOrg, name: initial?.orgName ?? "", city: initial?.city ?? "", state: initial?.state ?? "", pincode: initial?.pincode ?? "", address: initial?.address ?? "" });
  const [unit, setUnit] = useState<NewUnit>({ ...emptyUnit, name: initial?.unitName ?? "", city: initial?.city ?? "", state: initial?.state ?? "", pincode: initial?.pincode ?? "", address: initial?.address ?? "" });

  const orgs = orgsQ.data ?? [];
  const units = unitsQ.data ?? [];
  const orgUnits = units.filter((u) => u.customer_id === customerId);

  const isComplete =
    (orgMode === "existing" ? !!customerId : org.name.trim().length > 1) &&
    (unitMode === "existing" ? !!unitId && orgMode === "existing" : unit.name.trim().length > 1);

  /** Creates whatever is new and returns the final unit + organization ids. */
  async function commit(): Promise<{ customerId: string; unitId: string }> {
    let cid = customerId;
    if (orgMode === "new") {
      const code = nextCode(orgs.map((o) => o.code), "ORG");
      const { data, error } = await db.from("customers").insert({
        code, name: org.name.trim(), address: org.address.trim(),
        billing_name: org.name.trim(), billing_address1: org.address.trim(), billing_city: org.city.trim(),
        billing_state: org.state.trim(), billing_pincode: org.pincode.trim(), status: "active",
      }).select("id").single();
      if (error) throw new Error(error.message);
      cid = String(data.id);
      void logActivity({ module: "Customer Manager", action: "create", entityType: "customers", entityId: cid, entityLabel: `${code} ${org.name}`, details: { pan: org.pan, gst: org.gst } });
    }
    if (!cid) throw new Error("Choose or create an organization");
    let uid = unitId;
    if (unitMode === "new") {
      const code = nextCode(units.map((u) => u.code), "CLI");
      const lat = parseFloat(unit.latitude);
      const lng = parseFloat(unit.longitude);
      const { data, error } = await db.from("units").insert({
        code, name: unit.name.trim(), customer_id: cid, branch_id: unit.branchId || null,
        location: [unit.city, unit.state].filter(Boolean).join(", "),
        pan_number: org.pan.trim(), gst_number: org.gst.trim(),
        billing_address1: unit.address.trim(), billing_city: unit.city.trim(), billing_state: unit.state.trim(), billing_pincode: unit.pincode.trim(),
        client_address: unit.address.trim(), client_city: unit.city.trim(), client_state: unit.state.trim(), client_pincode: unit.pincode.trim(),
        latitude: Number.isFinite(lat) ? lat : null, longitude: Number.isFinite(lng) ? lng : null,
        coordinates_source: Number.isFinite(lat) && Number.isFinite(lng) ? "manual" : null,
        status: "active",
      }).select("id").single();
      if (error) throw new Error(error.message);
      uid = String(data.id);
      void logActivity({ module: "Clients", action: "create", entityType: "units", entityId: uid, entityLabel: `${code} ${unit.name}` });
    }
    if (!uid) throw new Error("Choose or create a unit");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["chain"] }),
      qc.invalidateQueries({ queryKey: ["admin"] }),
    ]);
    return { customerId: cid, unitId: uid };
  }

  function captureGps() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    navigator.geolocation.getCurrentPosition(
      (p) => setUnit((u) => ({ ...u, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => toast.error("Couldn't read your location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const view = (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary" /> 1. Organization</div>
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            {(["existing", "new"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setOrgMode(m); if (m === "new") { setUnitMode("new"); setUnitId(null); } }}
                className={cn("rounded-md px-2.5 py-1", orgMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {m === "existing" ? "Existing" : "New"}
              </button>
            ))}
          </div>
        </div>
        {orgMode === "existing" ? (
          <Picker items={orgs} value={customerId} onChange={(id) => { setCustomerId(id); setUnitId(null); }} placeholder={orgsQ.isLoading ? "Loading…" : "Select organization"} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Organization name *" className="sm:col-span-2"><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></F>
            <F label="PAN"><Input value={org.pan} onChange={(e) => setOrg({ ...org, pan: e.target.value.toUpperCase() })} /></F>
            <F label="GSTIN"><Input value={org.gst} onChange={(e) => setOrg({ ...org, gst: e.target.value.toUpperCase() })} /></F>
            <F label="Billing address" className="sm:col-span-2"><Input value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} /></F>
            <F label="City"><Input value={org.city} onChange={(e) => setOrg({ ...org, city: e.target.value })} /></F>
            <F label="State"><Input value={org.state} onChange={(e) => setOrg({ ...org, state: e.target.value })} /></F>
            <F label="Pincode"><Input value={org.pincode} inputMode="numeric" onChange={(e) => setOrg({ ...org, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></F>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> 2. Unit / site</div>
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            {(["existing", "new"] as const).map((m) => (
              <button key={m} type="button" disabled={m === "existing" && orgMode === "new"} onClick={() => setUnitMode(m)}
                className={cn("rounded-md px-2.5 py-1 disabled:opacity-40", unitMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {m === "existing" ? "Existing" : "New"}
              </button>
            ))}
          </div>
        </div>
        {unitMode === "existing" ? (
          <>
            <Picker items={orgUnits} value={unitId} onChange={setUnitId} disabled={!customerId} placeholder={customerId ? `Select unit (${orgUnits.length})` : "Select an organization first"} />
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Unit name *" className="sm:col-span-2"><Input value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} placeholder="e.g. Chakan Warehouse" /></F>
            <F label="Site address" className="sm:col-span-2"><Input value={unit.address} onChange={(e) => setUnit({ ...unit, address: e.target.value })} /></F>
            <F label="City"><Input value={unit.city} onChange={(e) => setUnit({ ...unit, city: e.target.value })} /></F>
            <F label="State"><Input value={unit.state} onChange={(e) => setUnit({ ...unit, state: e.target.value })} /></F>
            <F label="Pincode"><Input value={unit.pincode} inputMode="numeric" onChange={(e) => setUnit({ ...unit, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></F>
            <F label="Branch">
              <Select value={unit.branchId || undefined} onValueChange={(v) => setUnit({ ...unit, branchId: v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>{(branchesQ.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Latitude"><Input value={unit.latitude} onChange={(e) => setUnit({ ...unit, latitude: e.target.value })} /></F>
            <F label="Longitude"><Input value={unit.longitude} onChange={(e) => setUnit({ ...unit, longitude: e.target.value })} /></F>
            <div className="sm:col-span-2">
              <Button type="button" size="sm" variant="outline" onClick={captureGps}><MapPin className="mr-1.5 h-3.5 w-3.5" /> Use my current location</Button>
              <p className="mt-1 text-xs text-muted-foreground">The location is used for attendance geofencing at this site.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  return { view, commit, isComplete };
}

/** Dialog wrapper: create/select organization + unit, then hand back the unit id. */
export function OrgUnitQuickCreateDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (r: { customerId: string; unitId: string }) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {open && <QuickCreateBody onCancel={() => onOpenChange(false)} onDone={(r) => { onDone(r); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function QuickCreateBody({ onCancel, onDone }: { onCancel: () => void; onDone: (r: { customerId: string; unitId: string }) => void }) {
  const chain = useOrgUnitChain();
  const [saving, setSaving] = useState(false);
  return (
    <>
      <DialogHeader><DialogTitle>Organization &amp; unit</DialogTitle></DialogHeader>
      {chain.view}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!chain.isComplete || saving} onClick={async () => {
          setSaving(true);
          try { onDone(await chain.commit()); toast.success("Unit ready for the contract"); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
          finally { setSaving(false); }
        }}><Plus className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Use this unit"}</Button>
      </DialogFooter>
    </>
  );
}
