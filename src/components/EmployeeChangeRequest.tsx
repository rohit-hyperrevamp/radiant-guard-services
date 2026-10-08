import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileLock2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const FIELDS: Array<[string, string, string?]> = [
  ["full_name", "Full name"], ["date_of_birth", "Date of birth", "date"], ["aadhaar_number", "Aadhaar number"],
  ["pan_number", "PAN number"], ["bank_account_holder", "Account holder name"], ["bank_account_number", "Bank account number"],
  ["bank_ifsc", "IFSC code"], ["bank_name", "Bank name"], ["bank_branch", "Bank branch"],
];

/** Legal details of active employees change only through an approval request. */
export function EmployeeChangeRequest({ candidateId, current }: { candidateId: string; current: Record<string, unknown> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const pendingQ = useQuery({
    queryKey: ["employee-change-requests", candidateId],
    queryFn: async () => {
      const { data } = await db.from("approval_requests").select("id,status,payload,created_at")
        .eq("entity_id", candidateId).eq("workflow_key", "employee_sensitive_change").eq("status", "pending");
      return (data ?? []) as Array<{ id: string; payload: { changes?: Record<string, unknown> } }>;
    },
  });

  const submit = async () => {
    const changes: Record<string, string | null> = {};
    for (const [k] of FIELDS) {
      const v = vals[k];
      if (v !== undefined && v.trim() !== String(current[k] ?? "")) changes[k] = v.trim() || null;
    }
    if (Object.keys(changes).length === 0) { toast.error("Change at least one field"); return; }
    if (!reason.trim()) { toast.error("Please give a reason"); return; }
    setBusy(true);
    const { data, error } = await db.rpc("request_employee_change", { _candidate: candidateId, _changes: changes, _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    void logActivity({ module: "Employees", action: "request_change", entityType: "candidate", entityId: candidateId,
      entityLabel: String(current.full_name ?? ""), details: { fields: Object.keys(changes), reason: reason.trim(), request_id: data } });
    toast.success("Request sent for approval");
    setOpen(false); setVals({}); setReason("");
    qc.invalidateQueries({ queryKey: ["employee-change-requests", candidateId] });
  };

  const pending = pendingQ.data ?? [];
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        <FileLock2 className="h-4 w-4" /> Request change{pending.length ? ` (${pending.length} pending)` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request change to legal details</DialogTitle>
            <DialogDescription>
              Name, date of birth, Aadhaar, PAN and bank details are changed only after approval. Edit the fields to change and give a reason.
            </DialogDescription>
          </DialogHeader>
          {pending.length > 0 && (
            <div className="rounded-xl bg-accent p-3 text-xs text-accent-foreground">
              {pending.length} request(s) already waiting. <Link to="/admin/approvals" className="underline">Open Approvals</Link>
            </div>
          )}
          <div className="grid gap-3">
            {FIELDS.map(([k, label, type]) => (
              <div key={k} className="grid gap-1">
                <Label className="text-xs">{label}</Label>
                <Input type={type ?? "text"} value={vals[k] ?? String(current[k] ?? "")}
                  onChange={(e) => setVals((s) => ({ ...s, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="grid gap-1">
              <Label className="text-xs">Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Aadhaar was entered wrongly at joining" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
