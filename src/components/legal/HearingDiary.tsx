import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { confirmAction } from "@/components/ConfirmProvider";
import { logActivity } from "@/lib/activity-log";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Entry = {
  id: string;
  hearing_on: string;
  hearing_time: string | null;
  court_name: string | null;
  judge: string | null;
  purpose: string | null;
  attended_by: string | null;
  proceedings: string | null;
  order_passed: string | null;
  next_hearing_on: string | null;
  next_hearing_time: string | null;
  next_purpose: string | null;
};
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");
const today = () => new Date().toISOString().slice(0, 10);

/** Hearing diary: what happened on each date. Saving a next date also moves the case's next hearing (reminders follow it). */
export function HearingDiary({
  caseId,
  caseNumber,
  court,
  hearingOn,
  hearingTime,
  canEdit,
  canDelete,
  onChanged,
}: {
  caseId: string;
  caseNumber: string;
  court: string | null;
  hearingOn: string | null;
  hearingTime: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const key = ["legal-case-hearings", caseId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db
        .from("legal_case_hearings")
        .select("*")
        .eq("case_id", caseId)
        .order("hearing_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });
  const [f, setF] = useState<Partial<Entry> | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Entry, v: string) => setF((p) => ({ ...p, [k]: v || null }));

  const startNew = () =>
    setF({
      hearing_on: hearingOn && hearingOn <= today() ? hearingOn : today(),
      hearing_time: hearingTime,
      court_name: court,
    });

  const save = async () => {
    if (!f?.hearing_on) return toast.error("Enter the hearing date");
    setBusy(true);
    const payload = {
      case_id: caseId,
      hearing_on: f.hearing_on,
      hearing_time: f.hearing_time || null,
      court_name: f.court_name || null,
      judge: f.judge || null,
      purpose: f.purpose || null,
      attended_by: f.attended_by || null,
      proceedings: f.proceedings || null,
      order_passed: f.order_passed || null,
      next_hearing_on: f.next_hearing_on || null,
      next_hearing_time: f.next_hearing_time || null,
      next_purpose: f.next_purpose || null,
    };
    const res = f.id
      ? await db.from("legal_case_hearings").update(payload).eq("id", f.id)
      : await db.from("legal_case_hearings").insert(payload);
    if (res.error) {
      setBusy(false);
      return toast.error(res.error.message);
    }
    if (payload.next_hearing_on && (!hearingOn || payload.next_hearing_on >= (hearingOn ?? ""))) {
      await db
        .from("legal_cases")
        .update({ next_hearing_on: payload.next_hearing_on, next_hearing_time: payload.next_hearing_time })
        .eq("id", caseId);
    }
    await logActivity({
      module: "Case Desk",
      action: f.id ? "update" : "create",
      entityType: "legal_case_hearing",
      entityLabel: `${caseNumber} · hearing ${d(payload.hearing_on)}`,
      after: payload,
    });
    setBusy(false);
    setF(null);
    toast.success("Hearing diary saved");
    qc.invalidateQueries({ queryKey: key });
    onChanged();
  };

  const remove = async (e: Entry) => {
    if (!(await confirmAction({ title: "Delete this diary entry?", destructive: true }))) return;
    const { error } = await db.from("legal_case_hearings").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    await logActivity({
      module: "Case Desk",
      action: "delete",
      entityType: "legal_case_hearing",
      entityLabel: `${caseNumber} · hearing ${d(e.hearing_on)}`,
      before: e,
    });
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookOpen className="h-4 w-4" /> Hearing diary
        </div>
        {canEdit && !f && (
          <Button size="sm" variant="outline" onClick={startNew}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add hearing
          </Button>
        )}
      </div>

      {f && (
        <div className="mb-3 space-y-2 rounded-lg bg-muted/40 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              Hearing date
              <Input type="date" value={f.hearing_on ?? ""} onChange={(e) => set("hearing_on", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Time
              <Input type="time" value={f.hearing_time?.slice(0, 5) ?? ""} onChange={(e) => set("hearing_time", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Purpose (e.g. Evidence, Arguments)
              <Input value={f.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Court
              <Input value={f.court_name ?? ""} onChange={(e) => set("court_name", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Judge / officer
              <Input value={f.judge ?? ""} onChange={(e) => set("judge", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Attended by
              <Input value={f.attended_by ?? ""} onChange={(e) => set("attended_by", e.target.value)} />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            What happened
            <Textarea rows={3} value={f.proceedings ?? ""} onChange={(e) => set("proceedings", e.target.value)} />
          </label>
          <label className="block text-xs text-muted-foreground">
            Order / direction given
            <Textarea rows={2} value={f.order_passed ?? ""} onChange={(e) => set("order_passed", e.target.value)} />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              Next date
              <Input type="date" value={f.next_hearing_on ?? ""} onChange={(e) => set("next_hearing_on", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Next time
              <Input type="time" value={f.next_hearing_time?.slice(0, 5) ?? ""} onChange={(e) => set("next_hearing_time", e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              Next purpose
              <Input value={f.next_purpose ?? ""} onChange={(e) => set("next_purpose", e.target.value)} />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">The next date becomes the case's next hearing, and reminders follow it.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setF(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {(q.data ?? []).length === 0 && !f ? (
        <p className="text-xs text-muted-foreground">No hearings recorded yet.</p>
      ) : (
        <ol className="space-y-2">
          {(q.data ?? []).map((e) => (
            <li key={e.id} className="rounded-lg border border-border p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-foreground">
                  {d(e.hearing_on)}
                  {e.hearing_time ? ` · ${e.hearing_time.slice(0, 5)}` : ""}
                  {e.purpose ? ` · ${e.purpose}` : ""}
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button aria-label="Edit" onClick={() => setF(e)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button aria-label="Delete" onClick={() => remove(e)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-muted-foreground">
                {[e.court_name, e.judge && `Judge: ${e.judge}`, e.attended_by && `Attended: ${e.attended_by}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {e.proceedings && <p className="mt-1 whitespace-pre-wrap text-foreground">{e.proceedings}</p>}
              {e.order_passed && (
                <p className="mt-1 whitespace-pre-wrap text-foreground">
                  <b>Order:</b> {e.order_passed}
                </p>
              )}
              {e.next_hearing_on && (
                <p className="mt-1 text-muted-foreground">
                  Next: <b className="text-foreground">{d(e.next_hearing_on)}</b>
                  {e.next_hearing_time ? ` ${e.next_hearing_time.slice(0, 5)}` : ""}
                  {e.next_purpose ? ` · ${e.next_purpose}` : ""}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
