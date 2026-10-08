import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/admin/case-type-manager")({
  head: () => ({
    meta: [
      { title: "Case Types | Radiant Guard Services" },
      { name: "description", content: "Manage the categories used to log legal cases in Case Desk." },
      { property: "og:title", content: "Case Types | Radiant Guard Services" },
      { property: "og:description", content: "Manage the categories used to log legal cases in Case Desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaseTypes,
});

type T = { id: string; name: string; description: string; is_active: boolean; sort_order: number };
const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function CaseTypes() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const q = useQuery({
    queryKey: ["legal-case-types"],
    queryFn: async () => {
      const { data, error } = await db.from("legal_case_types").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["legal-case-types"] });

  const add = async () => {
    if (!name.trim()) return toast.error("Enter a name");
    const { data, error } = await db.from("legal_case_types").insert({ name: name.trim(), description: desc.trim(), sort_order: 500 }).select("id").single();
    if (error) return toast.error(error.message);
    void logActivity({ module: "Case Types", action: "create", entityType: "case_type", entityId: data?.id, entityLabel: name.trim() });
    setName(""); setDesc(""); refresh(); toast.success("Case type added");
  };
  const update = async (t: T, patch: Partial<T>) => {
    const { error } = await db.from("legal_case_types").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Case Types", action: patch.is_active === undefined ? "update" : patch.is_active ? "enable" : "disable", entityType: "case_type", entityId: t.id, entityLabel: t.name, details: patch });
    refresh();
  };
  const remove = async (t: T) => {
    if (!confirm(`Delete "${t.name}"? Cases using it keep their data but lose the type.`)) return;
    const { error } = await db.from("legal_case_types").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Case Types", action: "delete", entityType: "case_type", entityId: t.id, entityLabel: t.name });
    refresh();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Case Types" description="Categories shown when logging a case." crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Case Types" }]} />
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
        <Input placeholder="New case type" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Short description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {(q.data ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <Input defaultValue={t.name} className="h-8 font-medium" onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && update(t, { name: e.target.value.trim() })} />
              <Input defaultValue={t.description} placeholder="Description" className="mt-1 h-8 text-xs" onBlur={(e) => e.target.value !== t.description && update(t, { description: e.target.value })} />
            </div>
            <Switch checked={t.is_active} onCheckedChange={(v) => update(t, { is_active: v })} />
            <Button variant="ghost" size="sm" onClick={() => remove(t)}>Delete</Button>
          </div>
        ))}
        {q.data?.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No case types yet.</div>}
      </div>
    </div>
  );
}
