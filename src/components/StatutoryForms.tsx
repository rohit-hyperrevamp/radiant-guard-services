import { useEffect, useRef, useState } from "react";

const FORM_VIEWS = { esic37: Esic37Form, accident11: AccidentBookForm, epf11: Epf11Form, pf2: Pf2Form } as const;
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmployeePicker } from "@/components/EmployeePicker";
import { FORM_FONTS_HREF, FormProvider } from "@/components/statutory/form-kit";
import { Esic37Form } from "@/components/statutory/Esic37Form";
import { AccidentBookForm } from "@/components/statutory/AccidentBookForm";
import { Epf11Form } from "@/components/statutory/Epf11Form";
import { Pf2Form } from "@/components/statutory/Pf2Form";
import { printStatutorySheets } from "@/components/statutory/print-forms";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { statutoryForms, type FormId } from "@/lib/statutory-form-schema";
import { prefillStatutoryForm, missingStatutoryFields, type DraftValues, type EmployeeFormSource } from "@/lib/statutory-form-data";

export function StatutoryForms() {
  const permissions = useCurrentPermissions();
  const session = useHasSupabaseSession();
  const [formId, setFormId] = useState<FormId | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [values, setValues] = useState<DraftValues>({});
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [nomineeCount, setNomineeCount] = useState(1);
  const [familyCount, setFamilyCount] = useState(1);
  const allowed = !permissions.isLoading && session && permissions.can("employees", "view");
  const exportAllowed = allowed && permissions.canExport("employees");
  const data = useQuery({
    queryKey: ["statutory-form-source", employeeId],
    enabled: allowed && !!formId && !!employeeId,
    queryFn: async () => {
      const [employee, org] = await Promise.all([
        supabase.from("candidates").select("id,employee_code,full_name,date_of_birth,gender,marital_status,email,mobile,personal_mobile,aadhaar_number,pan_number,bank_account_number,bank_ifsc,preferred_joining_date,permanent_address1,permanent_address2,permanent_city,permanent_district,permanent_state,permanent_pincode,compliance,contacts,other_info").eq("id", employeeId).single(),
        supabase.from("org_settings").select("company_name,registered_address,esic_number,pf_number").maybeSingle(),
      ]);
      if (employee.error) throw employee.error;
      if (org.error) throw org.error;
      return {employee: employee.data as unknown as EmployeeFormSource, employer: (org.data ?? {}) as unknown as EmployeeFormSource};
    },
    staleTime: 0,
  });
  useEffect(() => {
    if (!formId || !data.data) return;
    const filled = prefillStatutoryForm(formId, data.data.employee, data.data.employer);
    setValues(filled); setVerified(false);
    setNomineeCount(Math.max(1, ...Array.from({length: 6}, (_, i) => filled[`nomName${i}`] ? i + 1 : 1)));
  }, [formId, data.data]);
  // Fonts used by the original forms, loaded only when this section is shown.
  useEffect(() => {
    if (document.querySelector(`link[href="${FORM_FONTS_HREF}"]`)) return;
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = FORM_FONTS_HREF; document.head.appendChild(link);
  }, []);
  const definition = statutoryForms.find(f => f.id === formId);
  const missing = formId ? missingStatutoryFields(formId, values) : [];
  const update = (key: string, value: string) => { setValues(v => ({...v, [key]: value})); setVerified(false); };
  async function exportPdf() {
    if (!formId || !exportAllowed || !data.data || data.isFetching || !sheetRef.current) return;
    setBusy(true);
    try { await printStatutorySheets(sheetRef.current, `${definition?.title ?? formId} - ${String(data.data.employee.employee_code ?? "employee")}`, !verified || missing.length > 0); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to export this form"); }
    finally { setBusy(false); }
  }
  const View = formId ? FORM_VIEWS[formId] : null;
  const hidden = (k: string) => {
    const nominee = /^nom\w+(\d)$/.exec(k), family = /^family\w+(\d)$/.exec(k);
    return (!!nominee && Number(nominee[1]) >= nomineeCount) || (!!family && Number(family[1]) >= familyCount);
  };
  if (!allowed) return null;
  return <section className="my-6 border-y border-border py-5">
    <h2 className="mb-3 text-base font-semibold">ESIC & EPF forms</h2>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {statutoryForms.map(f => <Button key={f.id} data-panel="true" variant="outline" className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-4 text-left" onClick={() => { setFormId(f.id); setEmployeeId(""); setValues({}); setVerified(false); setNomineeCount(1); setFamilyCount(1); }}>
        <FileText className="h-5 w-5 shrink-0 text-primary"/><span>{f.title}</span>
      </Button>)}
    </div>
    <Dialog open={!!formId} onOpenChange={open => { if (!open) {setFormId(null); setEmployeeId(""); setValues({});} }}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader><DialogTitle>{definition?.title}</DialogTitle><DialogDescription>Employee particulars and statutory declarations</DialogDescription></DialogHeader>
        <EmployeePicker value={employeeId} onChange={id => { setEmployeeId(id); setValues({}); setVerified(false); }} />
        {data.isFetching && employeeId && <p role="status" className="text-sm text-muted-foreground">Loading employee information…</p>}
        {data.isError && <p role="alert" className="text-sm text-destructive">Employee information could not be loaded. <Button variant="link" onClick={() => void data.refetch()}>Retry</Button></p>}
        {data.data && employeeId && !data.isFetching && <>
          <p className="text-xs text-muted-foreground">Type directly into the shaded boxes on the form. Click a tick box or Yes / No to mark it.</p>
          {View && <div className="max-h-[72dvh] overflow-auto rounded-md border border-border bg-muted p-4">
            <FormProvider value={{ values, set: update, hidden }}>
              <div ref={sheetRef} className="flex w-max flex-col items-center gap-6 mx-auto"><View /></div>
            </FormProvider>
          </div>}
          {formId === "pf2" && <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={nomineeCount === 6} onClick={() => setNomineeCount(n => n + 1)}><Plus/>EPF nominee</Button>
            <Button variant="outline" disabled={familyCount === 6} onClick={() => setFamilyCount(n => n + 1)}><Plus/>EPS family member</Button>
            {nomineeCount > 1 && <Button variant="outline" onClick={() => {const i = nomineeCount - 1; for (const k of ["nomName", "nomAddress", "nomRelation", "nomDob", "nomShare", "nomGuardian"]) update(`${k}${i}`, ""); setNomineeCount(i);}}><Trash2/>Last nominee</Button>}
          </div>}
          <div className="space-y-2 border-t border-border pt-3 text-sm">
            {missing.length > 0 && <details className="text-destructive"><summary>{missing.length} required details missing — draft only</summary><ul className="list-disc pl-5">{missing.map((m, i) => <li key={i}>{m}</li>)}</ul></details>}
            <p className="text-muted-foreground">Signatures, medical acceptance, attachments and statutory declarations require verification before submission.</p>
            <label className="flex items-start gap-2"><Checkbox checked={verified} disabled={missing.length > 0} onCheckedChange={v => setVerified(v === true)}/><span>I verified all particulars, applicable declarations and required signatures / attachments outside this export.</span></label>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3"><span className="text-xs text-muted-foreground">Choose “Save as PDF” in the print window.</span><Button disabled={!exportAllowed || busy} onClick={() => void exportPdf()}><Printer/>{verified && !missing.length ? "Export PDF" : "Export draft PDF"}</Button></div>
          {!exportAllowed && <p className="text-sm text-destructive">Employee export permission is required.</p>}
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}