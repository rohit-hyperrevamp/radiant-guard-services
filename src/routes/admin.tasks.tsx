import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { CheckCircle2, Clock, FileUp, Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/tasks")({
  validateSearch: (s: Record<string, unknown>) => ({ task: typeof s.task === "string" ? s.task : undefined }),
  head: () => ({
    meta: [
      { title: "Tasks | Radiant Guard Services" },
      { name: "description", content: "Assign, track and complete tasks with due dates, proof and extension requests." },
      { property: "og:title", content: "Tasks | Radiant Guard Services" },
      { property: "og:description", content: "Assign, track and complete tasks with due dates, proof and extension requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

type Task = {
  id: string; title: string; description: string; created_by: string; assignee_id: string;
  department_id: string | null; due_at: string | null; status: string; acknowledged_at: string | null;
  extension_until: string | null; extension_reason: string | null; completion_note: string | null;
  proof_paths: string[]; completed_at: string | null; created_at: string;
};
type Ev = { id: string; task_id: string; actor_id: string | null; kind: string; note: string | null; data: Record<string, unknown>; created_at: string };
type Person = { id: string; full_name: string | null; employee_code: string | null; department_id: string | null };

const db = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "New", cls: "bg-accent/15 text-accent" },
  acknowledged: { label: "Acknowledged", cls: "bg-primary/10 text-primary" },
  extension_requested: { label: "More time asked", cls: "bg-accent/20 text-accent-foreground" },
  completed: { label: "Completed", cls: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};
const fmt = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy, h:mm a") : "—");
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

function TasksPage() {
  const { candidateId } = useCurrentUserRole();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"mine" | "assigned" | "all" | "recent">("mine");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | undefined>(search.task);

  const permsQ = useQuery({
    queryKey: ["task-perms"],
    queryFn: async () => {
      const [a, o] = await Promise.all([db.rpc("current_user_can_assign_tasks"), db.rpc("current_user_is_task_overseer")]);
      return { canAssign: !!a.data, overseer: !!o.data };
    },
  });
  const tasksQ = useQuery({
    queryKey: ["tasks"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from("tasks").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
  const peopleQ = useQuery({
    queryKey: ["task-people"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates")
        .select("id,full_name,employee_code,department_id")
        .in("status", ["active", "approved"]).not("role_key", "in", "(guard,security_guard)")
        .order("full_name").limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Person[];
    },
  });
  const deptQ = useQuery({
    queryKey: ["task-departments"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const people = useMemo(() => new Map((peopleQ.data ?? []).map((p) => [p.id, p])), [peopleQ.data]);
  const depts = useMemo(() => new Map((deptQ.data ?? []).map((d) => [d.id, d.name])), [deptQ.data]);
  const name = (id?: string | null) => (id ? people.get(id)?.full_name ?? "Someone" : "—");

  const all = tasksQ.data ?? [];
  const done = (t: Task) => t.status === "completed" || t.status === "cancelled";
  const lists = {
    mine: all.filter((t) => t.assignee_id === candidateId && !done(t)),
    assigned: all.filter((t) => t.created_by === candidateId && !done(t)),
    all: all.filter((t) => !done(t)),
    recent: all.filter((t) => done(t)),
  };
  const tabs = [
    { k: "mine" as const, l: "My tasks" },
    ...(permsQ.data?.canAssign || lists.assigned.length ? [{ k: "assigned" as const, l: "Assigned by me" }] : []),
    ...(permsQ.data?.overseer ? [{ k: "all" as const, l: "All open" }] : []),
    { k: "recent" as const, l: "Recent tasks" },
  ];
  const rows = lists[tab];
  const current = all.find((t) => t.id === openId);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Tasks"
        description="Assign work with a due time, follow it until it is done, and keep the proof in one place."
        actions={permsQ.data?.canAssign ? (
          <Button onClick={() => setCreating(true)} className="gap-1"><Plus className="h-4 w-4" /> New task</Button>
        ) : undefined}
      />
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn("rounded-full border px-3 py-1.5 text-sm", tab === t.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted/50")}>
            {t.l} <span className="ml-1 opacity-70">{lists[t.k].length}</span>
          </button>
        ))}
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {tasksQ.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {!tasksQ.isLoading && rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No tasks here.</div>}
        {rows.map((t) => {
          const overdue = t.due_at && !done(t) && isPast(new Date(t.due_at));
          return (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/40">
              <div className="min-w-0">
                <div className="truncate font-medium">{t.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {name(t.created_by)} → {name(t.assignee_id)}{t.department_id ? ` · ${depts.get(t.department_id) ?? ""}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS[t.status]?.cls)}>{STATUS[t.status]?.label ?? t.status}</span>
                <span className={cn("flex items-center gap-1 text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                  <Clock className="h-3 w-3" /> {t.due_at ? fmt(t.due_at) : "No due date"}{overdue ? " · overdue" : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {creating && (
        <CreateTaskDialog
          people={peopleQ.data ?? []} departments={deptQ.data ?? []} me={candidateId}
          onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setTab("assigned"); refresh(); }}
        />
      )}
      {current && (
        <TaskDialog task={current} me={candidateId} overseer={!!permsQ.data?.overseer} name={name}
          deptName={current.department_id ? depts.get(current.department_id) : undefined}
          onClose={() => setOpenId(undefined)} onChanged={refresh} />
      )}
    </div>
  );
}

function CreateTaskDialog({ people, departments, me, onClose, onCreated }: {
  people: Person[]; departments: { id: string; name: string }[]; me: string | null;
  onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dept, setDept] = useState("");
  const [assignee, setAssignee] = useState("");
  const today6 = new Date(); today6.setHours(18, 0, 0, 0);
  const [due, setDue] = useState(toLocalInput(today6));
  const [saving, setSaving] = useState(false);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const options = people
    .filter((p) => !dept || p.department_id === dept)
    .map((p) => ({ value: p.id, label: `${p.full_name ?? "—"}${p.employee_code ? ` · ${p.employee_code}` : ""}`, hint: p.department_id ? deptName.get(p.department_id) : undefined }));

  const save = async () => {
    if (!title.trim() || !assignee || !me) return toast.error("Add a title and choose a person");
    setSaving(true);
    const person = people.find((p) => p.id === assignee);
    const { data, error } = await db.from("tasks").insert({
      title: title.trim(), description: desc.trim(), created_by: me, assignee_id: assignee,
      department_id: dept || person?.department_id || null, due_at: due ? new Date(due).toISOString() : null,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Tasks", action: "create", entityType: "task", entityId: data?.id, entityLabel: title.trim(), details: { assignee: person?.full_name, due } });
    toast.success("Task assigned");
    onCreated();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Describe what needs to be done" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Department (optional)</div>
              <SearchSelect value={dept} onChange={(v) => { setDept(v); setAssignee(""); }}
                options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
                placeholder="All departments" searchPlaceholder="Search departments…" />
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Assign to</div>
              <SearchSelect value={assignee} onChange={setAssignee} options={options} placeholder="Choose a person" searchPlaceholder="Search by name or ID…" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Complete by</div>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Assigning…" : "Assign task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EV_LABEL: Record<string, string> = {
  created: "Created the task", acknowledge: "Acknowledged", request_extension: "Asked for more time",
  approve_extension: "Approved new date", reject_extension: "Did not approve more time", complete: "Completed",
  reopen: "Reopened", cancel: "Cancelled", comment: "Commented",
};

function TaskDialog({ task: t, me, overseer, name, deptName, onClose, onChanged }: {
  task: Task; me: string | null; overseer: boolean; name: (id?: string | null) => string; deptName?: string;
  onClose: () => void; onChanged: () => void;
}) {
  const isAssignee = t.assignee_id === me;
  const isManager = t.created_by === me || overseer;
  const open = t.status !== "completed" && t.status !== "cancelled";
  const [mode, setMode] = useState<null | "extend" | "complete" | "decide" | "reopen">(null);
  const [note, setNote] = useState("");
  const [until, setUntil] = useState(toLocalInput(t.extension_until ? new Date(t.extension_until) : new Date(Date.now() + 86400000)));
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const evQ = useQuery({
    queryKey: ["task-events", t.id, t.status, t.due_at],
    queryFn: async () => {
      const { data } = await db.from("task_events").select("*").eq("task_id", t.id).order("created_at");
      return (data ?? []) as Ev[];
    },
  });
  const proofsQ = useQuery({
    queryKey: ["task-proofs", t.id, t.proof_paths.join(",")],
    enabled: t.proof_paths.length > 0,
    queryFn: async () => Promise.all(t.proof_paths.map(async (p) => {
      const { data } = await supabase.storage.from("task-proofs").createSignedUrl(p, 3600);
      return { path: p, url: data?.signedUrl ?? "" };
    })),
  });

  const act = async (action: string, extra: { until?: string; paths?: string[] } = {}) => {
    setBusy(true);
    const { error } = await db.rpc("task_action", {
      _task_id: t.id, _action: action, _note: note.trim() || null,
      _until: extra.until ? new Date(extra.until).toISOString() : null, _paths: extra.paths ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    void logActivity({ module: "Tasks", action: "update", entityType: "task", entityId: t.id, entityLabel: t.title, details: { action, note: note.trim() } });
    setNote(""); setMode(null); setFiles([]); onChanged();
    return true;
  };

  const complete = async () => {
    if (!note.trim()) return toast.error("Please write a note about the work");
    setBusy(true);
    const paths: string[] = [];
    for (const f of files) {
      const path = `${t.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("task-proofs").upload(path, f, { contentType: f.type || undefined });
      if (error) { setBusy(false); return toast.error(`Upload failed: ${error.message}`); }
      paths.push(path);
    }
    setBusy(false);
    if (await act("complete", { paths })) toast.success("Task completed");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6">{t.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS[t.status]?.cls)}>{STATUS[t.status]?.label}</span>
            {deptName && <Badge variant="outline">{deptName}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
            <div><div className="text-muted-foreground">Assigned by</div>{name(t.created_by)}</div>
            <div><div className="text-muted-foreground">Assigned to</div>{name(t.assignee_id)}</div>
            <div><div className="text-muted-foreground">Created</div>{fmt(t.created_at)}</div>
            <div><div className="text-muted-foreground">Complete by</div>{fmt(t.due_at)}</div>
          </div>
          {t.description && <p className="whitespace-pre-wrap">{t.description}</p>}
          {t.status === "extension_requested" && (
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs">
              <b>More time asked until {fmt(t.extension_until)}</b><div className="mt-1">{t.extension_reason}</div>
            </div>
          )}
          {t.completion_note && <div className="rounded-lg bg-primary/10 p-3 text-xs"><b>Completion note:</b> {t.completion_note}</div>}
          {(proofsQ.data ?? []).length > 0 && (
            <div className="space-y-1">
              {(proofsQ.data ?? []).map((p) => (
                <a key={p.path} href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary underline">
                  <Paperclip className="h-3 w-3" /> {p.path.split("/").pop()?.replace(/^\d+-/, "")}
                </a>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Timeline</div>
            <ol className="space-y-2 border-l border-border pl-3">
              {(evQ.data ?? []).map((e) => (
                <li key={e.id} className="text-xs">
                  <div><b>{name(e.actor_id)}</b> · {EV_LABEL[e.kind] ?? e.kind}
                    {typeof e.data?.until === "string" && <> · {fmt(e.data.until as string)}</>}
                  </div>
                  {e.note && e.kind !== "created" && <div className="text-muted-foreground">{e.note}</div>}
                  <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</div>
                </li>
              ))}
            </ol>
          </div>

          {mode === "extend" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">New date and time</div>
              <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
              <Textarea rows={3} placeholder="Why do you need more time?" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button disabled={busy || !note.trim()} onClick={async () => (await act("request_extension", { until })) && toast.success("Request sent")}>Send request</Button>
            </div>
          )}
          {mode === "complete" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Textarea rows={3} placeholder="What was done? If it couldn't be completed, write the reason." value={note} onChange={(e) => setNote(e.target.value)} />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-primary">
                <FileUp className="h-4 w-4" /> Attach proof (PDF or image)
                <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && <div className="text-xs text-muted-foreground">{files.map((f) => f.name).join(", ")}</div>}
              <Button disabled={busy || !note.trim()} onClick={complete} className="gap-1"><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : "Mark complete"}</Button>
            </div>
          )}
          {(mode === "decide" || mode === "reopen") && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{mode === "decide" ? "New due date (you can change it)" : "New due date"}</div>
              <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
              <Textarea rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              {mode === "decide" ? (
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={async () => (await act("approve_extension", { until })) && toast.success("New date set")}>Approve new date</Button>
                  <Button variant="outline" disabled={busy} onClick={() => act("reject_extension")}>Don't approve</Button>
                </div>
              ) : (
                <Button disabled={busy} onClick={() => act("reopen", { until })}>Reopen task</Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {isAssignee && t.status === "open" && <Button variant="outline" disabled={busy} onClick={() => act("acknowledge").then((ok) => ok && toast.success("Acknowledged"))}>Acknowledge</Button>}
          {isAssignee && open && <Button variant="outline" onClick={() => setMode("extend")}>Ask for more time</Button>}
          {isAssignee && open && <Button onClick={() => setMode("complete")}>Complete task</Button>}
          {isManager && t.status === "extension_requested" && <Button onClick={() => setMode("decide")}>Review time request</Button>}
          {isManager && !open && t.status === "completed" && <Button variant="outline" onClick={() => setMode("reopen")}>Reopen</Button>}
          {isManager && open && <Button variant="ghost" disabled={busy} onClick={() => act("cancel")}>Cancel task</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
