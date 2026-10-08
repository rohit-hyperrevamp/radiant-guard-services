import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation, searchImpersonationTargets } from "@/lib/impersonation.functions";
import { beginImpersonation, endImpersonation, readImpersonation, type ImpersonationState } from "@/lib/impersonation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = { id: string; full_name: string | null; employee_code: string | null; mobile: string | null; role_key: string | null };

const PAGE = 20;

export function ImpersonationBanner() {
  const [st, setSt] = useState<ImpersonationState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSt(readImpersonation()), []);
  if (!st) return null;
  const t = st.target;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-destructive px-3 py-2 text-center text-xs font-medium text-destructive-foreground safe-top sm:text-sm">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        Viewing as <b>{t.fullName || t.phone}</b>
        {t.employeeCode ? ` (${t.employeeCode}` : " ("}
        {t.roleKey ? `${t.employeeCode ? ", " : ""}${t.roleKey.replace(/_/g, " ")})` : ")"}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await endImpersonation();
        }}
        className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground"
      >
        <Undo2 className="h-3.5 w-3.5" /> {busy ? "Switching…" : "Back to Super Admin view"}
      </button>
    </div>
  );
}

export function ViewAsUserButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View as user"
        title="View as user"
        className={className ?? "grid h-11 w-11 place-items-center rounded-full text-foreground hover:bg-accent/10"}
      >
        <Eye className="h-5 w-5" />
      </button>
      {open && <ViewAsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ViewAsDialog({ onClose }: { onClose: () => void }) {
  const start = useServerFn(startImpersonation);
  const search = useServerFn(searchImpersonationTargets);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => setPage(0), [q]);
  useEffect(() => {
    let alive = true;
    const h = setTimeout(async () => {
      setLoading(true);
      let list: Row[] = [];
      let more = false;
      try {
        const res = await search({ data: { q: q.trim(), page } });
        list = res.rows as Row[];
        more = res.hasMore;
      } catch {
        list = [];
      }
      if (!alive) return;
      setHasMore(more);
      setRows(list);
      setLoading(false);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [q, page]);

  const pick = async (r: Row) => {
    setSwitching(r.id);
    try {
      const res = await start({ data: { candidateId: r.id } });
      await beginImpersonation(res, {
        phone: res.phone,
        fullName: res.fullName,
        employeeCode: res.employeeCode,
        roleKey: res.roleKey,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this view.");
      setSwitching(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>View as user</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          See the app exactly as this person does. Anything you save is saved as them.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, employee ID or mobile" className="pl-9" />
        </div>
        <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {loading && rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">Searching…</div>}
          {!loading && rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">No employees found.</div>}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={!!switching || r.role_key === "super_admin"}
              onClick={() => pick(r)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/5 disabled:opacity-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{r.full_name || "—"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[r.employee_code, r.mobile, r.role_key?.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-accent">{switching === r.id ? "Opening…" : "View"}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
