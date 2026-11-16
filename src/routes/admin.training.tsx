import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataPagination, usePagination } from "@/components/DataPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentPermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { TrainingCategories } from "@/components/TrainingCategories";
import { TrainingPreview } from "@/components/TrainingPreview";
import { TRAINING_CATEGORIES, categoryDocuments } from "@/lib/training-library";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { ScrollingText } from "@/components/ScrollingText";

export const Route = createFileRoute("/admin/training")({
  component: TrainingPage,
  head: () => ({
    meta: [
      { title: "Training | Radiant Guard Services" },
      { name: "description", content: "Manage Radiant department training guides and PDF documents." },
      { property: "og:title", content: "Training | Radiant Guard Services" },
      { property: "og:description", content: "Manage department training guides and PDF documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MODULE = "Training";
const BUCKET = "training";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Role = { key: string; name: string };
type TrainingModule = {
  id: string; role_key: string; title: string; description: string | null; file_path: string;
  file_name: string; mime_type: string | null; size_bytes: number | null; sort_order: number;
  version: number; is_active: boolean; created_at: string;
};

function fmtSize(n: number | null) {
  if (!n) return "—";
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function TrainingPage() {
  const { isSuperAdmin } = useCurrentPermissions();
  const hasSession = useHasSupabaseSession();
  const [roleKey, setRoleKey] = useState<string | null>(null);

  const modulesQ = useQuery({
    queryKey: ["training-modules"],
    enabled: hasSession && isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await db.from("training_modules").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as TrainingModule[];
    },
  });

  if (!isSuperAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Only Super Admin can manage training.</div>;
  }

  const modules = modulesQ.data ?? [];
  const category = TRAINING_CATEGORIES.find((r) => r.key === roleKey);
  const role = category ? { key: category.key, name: category.name } : null;

  if (role) {
    return <RoleModules role={role} modules={categoryDocuments(modules, role.key)} onBack={() => setRoleKey(null)} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Training"
        description={`${modules.length} training guides · Department library`}
        crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Training" }]}
      />
      {modulesQ.isLoading ? <p className="text-muted-foreground">Loading guides…</p> : modulesQ.isError ? <Button onClick={() => void modulesQ.refetch()}>Retry loading guides</Button> : <TrainingCategories documents={modules} onSelect={setRoleKey} includeEmpty />}
    </div>
  );
}

function RoleModules({ role, modules, onBack }: { role: Role; modules: TrainingModule[]; onBack: () => void }) {
  const qc = useQueryClient();
  const roleLabel = role.key === "guard" ? "Security Guard" : role.name;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TrainingModule | null>(null);
  const sorted = useMemo(() => [...modules].sort((a, b) => a.sort_order - b.sort_order), [modules]);
  const pg = usePagination(sorted, 20);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["training-modules"] }), qc.invalidateQueries({ queryKey: ["my-training-modules"] })]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error("Add a title and choose a file.");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${role.key}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) throw up.error;
      const nextOrder = modules.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1;
      const { error } = await db.from("training_modules").insert({
        role_key: role.key, title: title.trim(), description: description.trim() || null, file_path: path,
        file_name: file.name, mime_type: file.type || null, size_bytes: file.size, sort_order: nextOrder,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      await logActivity({ module: MODULE, action: "create", entityType: "training_module", entityLabel: `Added "${title.trim()}" for ${roleLabel}` });
    },
    onSuccess: () => { toast.success("Document added"); setTitle(""); setDescription(""); setFile(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (m: TrainingModule) => {
      const { error } = await db.from("training_modules").update({ is_active: !m.is_active }).eq("id", m.id);
      if (error) throw error;
      await logActivity({ module: MODULE, action: m.is_active ? "disable" : "enable", entityType: "training_module", entityLabel: `${m.is_active ? "Disabled" : "Enabled"} "${m.title}"` });
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (m: TrainingModule) => {
      const { error } = await db.from("training_modules").delete().eq("id", m.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([m.file_path]);
      await logActivity({ module: MODULE, action: "delete", entityType: "training_module", entityLabel: `Deleted "${m.title}" from ${roleLabel}` });
    },
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = (m: TrainingModule) => setPreview(m);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Training — ${roleLabel}`}
        description={`${modules.length} department guides`}
        crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Training" }, { label: roleLabel }]}
      />
      <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All categories</Button>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sm:w-60" />
        <Button onClick={() => upload.mutate()} disabled={upload.isPending}>
          <Upload className="mr-1 h-4 w-4" />{upload.isPending ? "Uploading…" : "Add"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="p-2">#</th><th className="p-2">Document</th><th className="p-2">Size</th><th className="p-2">Added</th><th className="p-2">Active</th><th className="p-2 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {pg.pageRows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No documents yet for this role.</td></tr>
            )}
            {pg.pageRows.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-2">{m.sort_order}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 shrink-0 text-accent" /><ScrollingText text={m.title} className="max-w-sm" /></div>
                  {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                  <div className="text-xs text-muted-foreground">{m.file_name}</div>
                </td>
                <td className="p-2">{fmtSize(m.size_bytes)}</td>
                <td className="p-2">{new Date(m.created_at).toLocaleDateString("en-IN")}</td>
                <td className="p-2"><Switch checked={m.is_active} onCheckedChange={() => toggle.mutate(m)} /></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => open(m)}><ExternalLink className="mr-1 h-4 w-4" />Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${m.title}"?`)) remove.mutate(m); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataPagination {...pg} />
      <TrainingPreview document={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
