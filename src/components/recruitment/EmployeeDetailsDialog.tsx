import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/lib/activity-log";
import { addEvent, recDb, REC_MODULE, REQUIRED_EMPLOYEE_DETAILS, type RecCandidate } from "@/lib/recruitment";

type D = Record<string, string | boolean>;
const REQ = new Set(REQUIRED_EMPLOYEE_DETAILS.map(([k]) => k));

const OPTS: Record<string, string[]> = {
  gender: ["Male", "Female", "Other"],
  marital_status: ["Single", "Married", "Divorced", "Widowed"],
  blood_group: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  bank_account_type: ["Savings", "Current", "Salary"],
  caste_category: ["General", "OBC", "SC", "ST", "Other"],
};

const SECTIONS: { title: string; fields: [string, string, string?][] }[] = [
  { title: "Personal", fields: [["date_of_birth", "Date of birth", "date"], ["gender", "Gender"], ["marital_status", "Marital status"], ["blood_group", "Blood group"], ["religion", "Religion"], ["caste_category", "Category"], ["father_name", "Father's name"], ["mother_name", "Mother's name"], ["spouse_name", "Spouse name"], ["alt_mobile", "Alternate mobile", "tel"]] },
  { title: "Identity & statutory", fields: [["aadhaar_number", "Aadhaar number"], ["pan_number", "PAN"], ["uan", "UAN (PF)"], ["esic_number", "ESIC number"]] },
  { title: "Permanent address", fields: [["permanent_address1", "Address line 1"], ["permanent_address2", "Address line 2"], ["permanent_landmark", "Landmark"], ["permanent_city", "City"], ["permanent_district", "District"], ["permanent_state", "State"], ["permanent_pincode", "Pincode"]] },
  { title: "Present address", fields: [["present_address1", "Address line 1"], ["present_address2", "Address line 2"], ["present_landmark", "Landmark"], ["present_city", "City"], ["present_district", "District"], ["present_state", "State"], ["present_pincode", "Pincode"]] },
  { title: "Bank", fields: [["bank_account_holder", "Account holder"], ["bank_account_number", "Account number"], ["bank_ifsc", "IFSC"], ["bank_name", "Bank name"], ["bank_branch", "Branch"], ["bank_account_type", "Account type"]] },
  { title: "Emergency contact", fields: [["emergency_contact_name", "Name"], ["emergency_contact_relation", "Relation"], ["emergency_contact_mobile", "Mobile", "tel"]] },
];

export function EmployeeDetailsDialog({ candidate, onClose }: { candidate: RecCandidate; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<D>({ same_as_permanent: true, bank_account_type: "Savings", bank_account_holder: candidate.full_name, ...(candidate.employee_details ?? {}) });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setD((p) => ({ ...p, [k]: v }));
  const same = d.same_as_permanent !== false;

  async function save() {
    const aad = String(d.aadhaar_number ?? "").replace(/\s/g, "");
    if (aad && !/^\d{12}$/.test(aad)) return toast.error("Aadhaar must be 12 digits");
    const pan = String(d.pan_number ?? "").toUpperCase().trim();
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return toast.error("PAN format looks wrong (e.g. ABCDE1234F)");
    const ifsc = String(d.bank_ifsc ?? "").toUpperCase().trim();
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return toast.error("IFSC format looks wrong");
    const pin = String(d.permanent_pincode ?? "").trim();
    if (pin && !/^\d{6}$/.test(pin)) return toast.error("Pincode must be 6 digits");
    const clean: D = { ...d, aadhaar_number: aad, pan_number: pan, bank_ifsc: ifsc };
    setBusy(true);
    try {
      const { error } = await recDb.from("rec_candidates").update({ employee_details: clean }).eq("id", candidate.id);
      if (error) throw error;
      await addEvent(candidate.id, "employee_details", "Employee details updated");
      void logActivity({ module: REC_MODULE, action: "update", entityType: "rec_candidates", entityId: candidate.id, entityLabel: candidate.code, details: { employee_details: true } });
      toast.success("Employee details saved");
      await qc.invalidateQueries({ queryKey: ["rec"] });
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Employee details · {candidate.full_name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Fill everything the employee record needs. The HR Head will only set up the salary. Fields marked * are required before sending to the HR Head.</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">{s.title}</h3>
              {s.title === "Present address" && (
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={same} onCheckedChange={(v) => set("same_as_permanent", v === true)} />Same as permanent</label>
              )}
            </div>
            {!(s.title === "Present address" && same) && (
              <div className="grid gap-3 sm:grid-cols-3">
                {s.fields.map(([k, label, type]) => (
                  <div key={k} className="space-y-1">
                    <Label>{label}{REQ.has(k) ? " *" : ""}</Label>
                    {OPTS[k] ? (
                      <Select value={String(d[k] ?? "")} onValueChange={(v) => set(k, v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{OPTS[k].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input type={type ?? "text"} value={String(d[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save details"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
