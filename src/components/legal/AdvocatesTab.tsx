import { matchesSearch } from "@/lib/search-match";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { confirmAction } from "@/components/ConfirmProvider";
import { useLegalMasters, LEGAL_MASTERS_KEY, type Advocate } from "@/lib/legal";
import { logActivity } from "@/lib/activity-log";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");
const KIND = { in_house: "Our advocate", retainer: "Retainer (third-party)" } as const;

export function AdvocatesTab({ canEdit }: { canEdit: boolean }) {
  const m = useLegalMasters();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Advocate> | null>(null);
  const [q, setQ] = useState("");
  const log = useQuery({
    queryKey: ["legal-advocate-log"],
    queryFn: async () => {
      const { data } = await db
        .from("legal_case_advocate_log")
        .select("id,advocate_id,advocate_name,from_date,to_date,note,legal_cases(case_number,title,status)")
        .order("from_date", { ascending: false })
        .limit(2000);
      return (data ?? []) as {
        id: string;
        advocate_id: string | null;
        advocate_name: string;
        from_date: string;
        to_date: string | null;
        note: string;
        legal_cases: { case_number: string; title: string; status: string } | null;
      }[];
    },
  });
  const [open, setOpen] = useState<string | null>(null);
  const list = (m.data?.advocates ?? []).filter((a) =>
    matchesSearch(q, [a.name, a.firm, a.phone, a.email]),
  );
  const save = async () => {
    const f = editing!;
    if (!f.name?.trim()) return toast.error("Enter the advocate's name");
    if (!(await confirmAction({ title: f.id ? "Save changes?" : "Add this advocate?", confirmText: "Yes, save" }))) return;
    const payload = {
      name: f.name.trim(),
      kind: f.kind ?? "retainer",
      phone: f.phone?.trim() || null,
      email: f.email?.trim() || null,
      firm: f.firm?.trim() || null,
      bar_council_no: f.bar_council_no?.trim() || null,
      address: f.address?.trim() || null,
      engaged_on: f.engaged_on || null,
      is_active: f.is_active ?? true,
      notes: f.notes ?? "",
    };
    const res = f.id
      ? await db.from("legal_advocates").update(payload).eq("id", f.id)
      : await db.from("legal_advocates").insert(payload);
    if (res.error) return toast.error(res.error.message);
    void logActivity({
      module: "Case Desk",
      action: f.id ? "update" : "create",
      entityType: "legal_advocate",
      entityId: f.id,
      entityLabel: payload.name,
      details: payload,
    });
    toast.success("Advocate saved");
    qc.invalidateQueries({ queryKey: LEGAL_MASTERS_KEY });
    setEditing(null);
  };
  const set = (k: keyof Advocate, v: unknown) => setEditing((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Search advocate, firm, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canEdit && (
          <Button onClick={() => setEditing({ kind: "retainer", is_active: true })}>
            <Plus className="mr-1 h-4 w-4" /> Add advocate
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {list.map((a) => {
          const used = (log.data ?? []).filter((l) => l.advocate_id === a.id);
          return (
            <div key={a.id} className="border-b border-border last:border-0">
              <button data-panel="true" className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/5" onClick={() => setOpen(open === a.id ? null : a.id)}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {KIND[a.kind]}
                    {a.firm ? ` · ${a.firm}` : ""}
                    {a.phone ? ` · ${a.phone}` : ""}
                    {a.email ? ` · ${a.email}` : ""}
                    {a.engaged_on ? ` · engaged ${d(a.engaged_on)}` : ""}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{used.length} case{used.length === 1 ? "" : "s"}</span>
                {!a.is_active && <span className="rounded-full bg-muted px-2 text-[11px]">Inactive</span>}
              </button>
              {open === a.id && (
                <div className="space-y-1 px-3 pb-3 text-xs">
                  {used.map((l) => (
                    <div key={l.id} className="rounded bg-muted/40 px-2 py-1">
                      {l.legal_cases?.case_number} · {l.legal_cases?.title} · {d(l.from_date)} – {l.to_date ? d(l.to_date) : "now"}
                    </div>
                  ))}
                  {used.length === 0 && <div className="text-muted-foreground">Not used on any case yet.</div>}
                  {canEdit && (
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => setEditing(a)}>
                      Edit details
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!m.isLoading && list.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No advocates yet.</div>}
      </div>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit advocate" : "Add advocate"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Name *" value={editing.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              <SearchSelect
                value={editing.kind ?? "retainer"}
                onChange={(v) => set("kind", v)}
                options={Object.entries(KIND).map(([value, label]) => ({ value, label }))}
              />
              <Input placeholder="Phone" value={editing.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              <Input placeholder="Email" value={editing.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              <Input placeholder="Firm / chamber" value={editing.firm ?? ""} onChange={(e) => set("firm", e.target.value)} />
              <Input placeholder="Bar Council enrolment no." value={editing.bar_council_no ?? ""} onChange={(e) => set("bar_council_no", e.target.value)} />
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Engaged on</span>
                <Input type="date" value={editing.engaged_on ?? ""} onChange={(e) => set("engaged_on", e.target.value)} />
              </label>
              <SearchSelect
                value={editing.is_active === false ? "no" : "yes"}
                onChange={(v) => set("is_active", v === "yes")}
                options={[
                  { value: "yes", label: "Active" },
                  { value: "no", label: "Inactive" },
                ]}
              />
              <Input className="sm:col-span-2" placeholder="Address" value={editing.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              <Textarea className="sm:col-span-2" rows={2} placeholder="Notes (fees, specialisation…)" value={editing.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button data-no-confirm="true" onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
