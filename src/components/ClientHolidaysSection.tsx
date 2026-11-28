import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateReference } from "@/lib/reference-data";
import { QK_CLIENT_HOLIDAYS } from "@/lib/public-holidays";
import { matchesSearch } from "@/lib/search-match";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

type Row = {
  id: string;
  holiday_date: string;
  name: string;
  customer_id: string | null;
  unit_ids: string[];
  enabled: boolean;
  notes: string;
};
type Customer = { id: string; name: string };
type Unit = { id: string; code: string | null; name: string | null; customer_id: string | null };

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Client holidays: a client's or site's own dated holiday (state / city festival).
 * On that date, employees present at those sites earn the site's PH credit from
 * Inclusions (+1 / +1.5 / +2), shown as "PH" in the ED row of the attendance sheet.
 */
export function ClientHolidaysSection() {
  const session = useHasSupabaseSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);

  const holidaysQ = useQuery({
    queryKey: [...QK_CLIENT_HOLIDAYS, "admin"],
    enabled: session,
    queryFn: async () => {
      const { data, error } = await db
        .from("client_holidays")
        .select("id,holiday_date,name,customer_id,unit_ids,enabled,notes")
        .order("holiday_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const customersQ = useQuery({
    queryKey: ["client-holidays", "customers"],
    enabled: session,
    queryFn: async () => {
      const { data, error } = await db.from("customers").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
  const unitsQ = useQuery({
    queryKey: ["client-holidays", "units"],
    enabled: session,
    queryFn: async () => {
      const out: Unit[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from("units")
          .select("id,code,name,customer_id")
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        out.push(...((data ?? []) as Unit[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
  const customerName = useMemo(
    () => new Map((customersQ.data ?? []).map((c) => [c.id, c.name])),
    [customersQ.data],
  );
  const unitById = useMemo(() => new Map((unitsQ.data ?? []).map((u) => [u.id, u])), [unitsQ.data]);

  const refresh = async () => {
    invalidateReference(qc, "clientHolidays");
    await qc.invalidateQueries({ queryKey: [...QK_CLIENT_HOLIDAYS] });
  };
  const toggle = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await db
        .from("client_holidays")
        .update({ enabled: !r.enabled })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("client_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Client holiday removed");
      await refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const rows = (holidaysQ.data ?? []).filter((r) =>
    matchesSearch(deferredFilter, [
      r.name,
      r.holiday_date,
      r.customer_id ? customerName.get(r.customer_id) : "",
      ...r.unit_ids.map((u) => unitById.get(u)?.code ?? ""),
    ]),
  );

  return (
    <section className="mt-6 rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> Client holidays
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            A client&rsquo;s or site&rsquo;s own holiday on a specific date (state or city
            festival). Employees present that day earn the site&rsquo;s PH credit from Inclusions,
            shown as &ldquo;PH&rdquo; in the ED row.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search client, site or date…"
            className="h-9 w-56"
          />
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add client holiday
          </Button>
        </div>
      </div>
      {holidaysQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !rows.length ? (
        <div className="text-sm text-muted-foreground">No client holidays yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Holiday</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Sites</th>
                <th className="py-2 pr-3">Enabled</th>
                <th className="py-2" data-col="actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 font-medium">
                    {fmtDate(r.holiday_date)}
                  </td>
                  <td className="py-2 pr-3">
                    {r.name}
                    {r.notes ? (
                      <div className="text-xs text-muted-foreground">{r.notes}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {r.customer_id ? (customerName.get(r.customer_id) ?? "—") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.unit_ids
                      .map((u) => unitById.get(u)?.code ?? "?")
                      .slice(0, 6)
                      .join(", ")}
                    {r.unit_ids.length > 6 ? ` +${r.unit_ids.length - 6} more` : ""}
                  </td>
                  <td className="py-2 pr-3">
                    <Switch
                      aria-label="Enabled"
                      checked={r.enabled}
                      disabled={toggle.isPending}
                      onCheckedChange={() => toggle.mutate(r)}
                    />
                  </td>
                  <td className="py-2 text-right" data-col="actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(r.id)}
                      aria-label="Remove client holiday"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddClientHolidayDialog
        open={open}
        onOpenChange={setOpen}
        customers={customersQ.data ?? []}
        units={unitsQ.data ?? []}
        onSaved={refresh}
      />
    </section>
  );
}

function AddClientHolidayDialog({
  open,
  onOpenChange,
  customers,
  units,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: Customer[];
  units: Unit[];
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const deferredCustomer = useDeferredValue(customerQuery);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const clientUnits = useMemo(
    () =>
      units
        .filter((u) => u.customer_id === customerId)
        .sort((a, b) => String(a.code).localeCompare(String(b.code))),
    [units, customerId],
  );
  const customerHits = useMemo(
    () =>
      deferredCustomer.trim()
        ? customers.filter((c) => matchesSearch(deferredCustomer, [c.name])).slice(0, 12)
        : [],
    [customers, deferredCustomer],
  );
  const reset = () => {
    setDate("");
    setName("");
    setCustomerQuery("");
    setCustomerId(null);
    setPicked(new Set());
  };
  const save = async () => {
    if (!date || !name.trim()) return toast.error("Enter the date and holiday name");
    if (!picked.size) return toast.error("Pick at least one site");
    setSaving(true);
    try {
      const { error } = await db.from("client_holidays").insert({
        holiday_date: date,
        name: name.trim(),
        customer_id: customerId,
        unit_ids: Array.from(picked),
      });
      if (error) throw error;
      toast.success("Client holiday added");
      await onSaved();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add client holiday</DialogTitle>
          <DialogDescription>
            The sites below earn their Inclusions PH credit for employees present on this date.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Holiday</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ganesh Chaturthi"
              />
            </div>
          </div>
          <div>
            <Label>Client</Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">{customers.find((c) => c.id === customerId)?.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomerId(null);
                    setPicked(new Set());
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search client…"
                />
                {customerHits.length ? (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border">
                    {customerHits.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setCustomerId(c.id);
                          setPicked(
                            new Set(units.filter((u) => u.customer_id === c.id).map((u) => u.id)),
                          );
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          {customerId ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>
                  Sites ({picked.size} of {clientUnits.length})
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPicked(
                      picked.size === clientUnits.length
                        ? new Set()
                        : new Set(clientUnits.map((u) => u.id)),
                    )
                  }
                >
                  {picked.size === clientUnits.length ? "Clear" : "All sites"}
                </Button>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {clientUnits.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.has(u.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(picked);
                        if (v) next.add(u.id);
                        else next.delete(u.id);
                        setPicked(next);
                      }}
                    />
                    <span className="font-mono text-xs">{u.code}</span>
                    <span className="truncate">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Add holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
