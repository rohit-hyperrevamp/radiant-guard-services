import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/admin/system-backups")({
  head: () => ({
    meta: [
      { title: "System Backups | Radiant Guard Services" },
      { name: "description", content: "Take full system backups and restore the whole system to a saved point." },
      { property: "og:title", content: "System Backups | Radiant Guard Services" },
      { property: "og:description", content: "Take full system backups and restore the whole system to a saved point." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemBackups,
});

type Snap = { id: string; label: string; created_at: string; restored_at: string | null; table_count: number };

function SystemBackups() {
  const { isSuperAdmin } = useCurrentPermissions();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const list = useQuery({
    queryKey: ["system-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_snapshots" as never)
        .select("id,label,created_at,restored_at,table_count")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Snap[];
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_system_snapshot" as never, { _label: label } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Backup saved");
      void logActivity({ module: "System Backups", action: "create", description: `Backup ${label}` } as never);
      setLabel("");
      void qc.invalidateQueries({ queryKey: ["system-snapshots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: async (s: Snap) => {
      const { error } = await supabase.rpc("restore_system_snapshot" as never, { _id: s.id } as never);
      if (error) throw error;
      return s;
    },
    onSuccess: (s) => {
      toast.success(`Restored to "${s.label}". Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuperAdmin) return <p className="p-6 text-muted-foreground">Only Super Admin can use backups.</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Backups"
        description="Save the whole system and put it back to a saved point."
        crumbs={[{ label: "Control Center", to: "/admin/control-center" } as never, { label: "System Backups" }]}
      />
      <div className="flex gap-2 rounded-xl border border-border bg-card p-4">
        <Input placeholder="Backup name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Saving… (a few minutes)" : "Take backup now"}
        </Button>
      </div>
      <div className="space-y-2">
        {(list.data ?? []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4">
            <div>
              <div className="font-medium text-foreground">{s.label}</div>
              <div className="text-sm text-muted-foreground">
                Saved {new Date(s.created_at).toLocaleString()}
                {s.restored_at ? ` · last restored ${new Date(s.restored_at).toLocaleString()}` : ""}
              </div>
            </div>
            <Button
              variant="destructive"
              disabled={restore.isPending}
              onClick={() => {
                if (window.confirm(`Reset the WHOLE system to "${s.label}"? Everything entered after it will be lost.`)) restore.mutate(s);
              }}
            >
              {restore.isPending ? "Restoring…" : "Restore to this point"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
