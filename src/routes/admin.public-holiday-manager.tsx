import { createFileRoute } from "@tanstack/react-router";
import { DataPagination, usePagination } from "@/components/DataPagination";
import { useMemo, useState } from "react";
import { CalendarHeart, Download, Edit2, Plus, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES, type PublicHoliday, QK_PUBLIC_HOLIDAYS } from "@/lib/public-holidays";

export const Route = createFileRoute("/admin/public-holiday-manager")({
  component: PublicHolidayManagerPage,
});

type Payload = Omit<PublicHoliday, "id">;

function usePublicHolidayAdmin() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: QK_PUBLIC_HOLIDAYS,
    queryFn: async (): Promise<PublicHoliday[]> => {
      const { data, error } = await supabase
        .from("public_holidays" as never)
        .select("id,name,holiday_month,holiday_day,enabled,sort_order")
        .order("holiday_month")
        .order("holiday_day");
      if (error) throw error;
      return ((data as unknown) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        month: Number(r.holiday_month ?? 1),
        day: Number(r.holiday_day ?? 1),
        enabled: Boolean(r.enabled ?? true),
        sortOrder: Number(r.sort_order ?? 0),
      }));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK_PUBLIC_HOLIDAYS });
  const toRow = (p: Payload) => ({
    name: p.name.trim(),
    holiday_month: Number(p.month),
    holiday_day: Number(p.day),
    enabled: p.enabled,
    sort_order: Number(p.sortOrder) || 0,
  });

  const addMut = useMutation({
    mutationFn: async (p: Payload) => {
      if (!p.name.trim()) throw new Error("Name is required");
      const { error } = await supabase.from("public_holidays" as never).insert(toRow(p) as never);
      if (error) throw error;
      void logActivity({ module: "Public Holiday Manager", action: "create", entityType: "public_holidays", entityLabel: p.name, details: toRow(p) });
    },
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, p }: { id: string; p: Payload }) => {
      const { error } = await supabase.from("public_holidays" as never).update(toRow(p) as never).eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Public Holiday Manager", action: "update", entityType: "public_holidays", entityId: id, entityLabel: p.name, details: toRow(p) });
    },
    onSuccess: invalidate,
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("public_holidays" as never).update({ enabled } as never).eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Public Holiday Manager", action: enabled ? "enable" : "disable", entityType: "public_holidays", entityId: id, details: { enabled } });
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_holidays" as never).delete().eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Public Holiday Manager", action: "delete", entityType: "public_holidays", entityId: id });
    },
    onSuccess: invalidate,
  });

  return { items, addMut, updateMut, toggleMut, deleteMut };
}

function PublicHolidayManagerPage() {
  const { items, addMut, updateMut, toggleMut, deleteMut } = usePublicHolidayAdmin();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PublicHoliday | null>(null);
  const [deleting, setDeleting] = useState<PublicHoliday | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || MONTH_NAMES[i.month - 1].toLowerCase().includes(q));
  }, [items, query]);

  const pg = usePagination(filtered);

  return (
    <div>
      <PageHeader
        title="Public Holiday Manager"
        description="Maintain the public holiday (PH) calendar used by unit-level PH multipliers on attendance."
        crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Public Holidays" }]}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search holiday…"
            className="h-10 rounded-lg pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={filtered.length === 0}
            onClick={() =>
              downloadCsv(
                "public-holidays",
                filtered.map((i) => ({
                  name: i.name,
                  date: `${String(i.day).padStart(2, "0")} ${MONTH_NAMES[i.month - 1]}`,
                  enabled: i.enabled ? "Yes" : "No",
                })),
                [
                  { key: "name", header: "Holiday" },
                  { key: "date", header: "Date" },
                  { key: "enabled", header: "Enabled" },
                ],
              )
            }
            className="h-10 rounded-lg"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button
            onClick={() => setAddOpen(true)}
            className="h-10 rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Public Holiday
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-accent/10 px-5 py-2.5 text-xs font-medium text-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">{filtered.length}</span>
            <span className="uppercase tracking-[0.14em] text-muted-foreground">Total {filtered.length === 1 ? "row" : "rows"}</span>
          </span>
        </div>
        <div className="overflow-x-clip">
          <table className="ios-table w-full text-sm">
            <thead className="bg-secondary/60 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Holiday</th>
                <th className="px-5 py-3">Date (repeats yearly)</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right" data-col="actions">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pg.pageRows.map((i) => (
                <tr key={i.id} className="hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <CalendarHeart className="h-4 w-4 text-muted-foreground" />
                      {i.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-foreground/90">
                    {String(i.day).padStart(2, "0")} {MONTH_NAMES[i.month - 1]}
                  </td>
                  <td className="px-5 py-3">
                    <Switch
                      checked={i.enabled}
                      onCheckedChange={(v) =>
                        toggleMut.mutate(
                          { id: i.id, enabled: v },
                          {
                            onSuccess: () => toast.success(v ? "Enabled" : "Disabled"),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
                          },
                        )
                      }
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => setEditing(i)} aria-label="Edit">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(i)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No public holidays found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <DataPagination {...pg} />
        </div>
      </div>

      <HolidayFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Public Holiday"
        onSubmit={async (p) => {
          try {
            await addMut.mutateAsync(p);
            toast.success("Public holiday added");
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Could not add holiday";
          }
        }}
      />

      <HolidayFormDialog
        open={!!editing}
        initial={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit Public Holiday"
        onSubmit={async (p) => {
          if (!editing) return null;
          try {
            await updateMut.mutateAsync({ id: editing.id, p });
            toast.success("Public holiday updated");
            setEditing(null);
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Could not update holiday";
          }
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this public holiday?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && <span className="font-semibold text-foreground">{deleting.name}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteMut.mutateAsync(deleting.id);
                  toast.success("Public holiday deleted");
                  setDeleting(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Delete failed");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HolidayFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial?: PublicHoliday | null;
  onSubmit: (p: Payload) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [month, setMonth] = useState("1");
  const [day, setDay] = useState("1");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initial?.name ?? "");
      setMonth(String(initial?.month ?? 1));
      setDay(String(initial?.day ?? 1));
      setEnabled(initial?.enabled ?? true);
    }
  }

  const maxDay = new Date(2024, Number(month), 0).getDate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Repeats every year on the same date.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Holiday name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Republic Day" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, idx) => (
                    <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Enabled</div>
              <div className="text-xs text-muted-foreground">Apply on attendance for PH-enabled clients</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const err = await onSubmit({
                name,
                month: Number(month),
                day: Number(day),
                enabled,
                sortOrder: initial?.sortOrder ?? 0,
              });
              setSaving(false);
              if (err) toast.error(err);
              else onOpenChange(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
