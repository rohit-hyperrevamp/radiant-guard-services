import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Download, Save, Pencil, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { recDb as supabase } from "@/lib/recruitment";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { fetchCandidateForRender, fetchActiveTemplate } from "@/lib/company-documents";
import { uploadFollowupDocument, DOCUMENT_FOLLOWUP_QK } from "@/lib/document-followup-data";
import { logActivity } from "@/lib/activity-log";
import { LETTER_LABELS, LETTER_GROUPS, LETTER_FIELDS, letterFieldKeys, employeeLetterFields, createLetter, decodeLetter, letterPdf, downloadLetter, fitLetterLine, type LetterLine, type LetterCopy, type LetterKind } from "@/lib/employment-letters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FittedDocument } from "@/components/FittedDocument";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "./employment-letters.css";

type Saved = { id: string; rendered_body: string; version: number; created_at: string; signed_at: string | null; issued_at: string | null };

export function EmploymentLetters({ candidateId, group = "hiring", initialOpen = false, launcherHidden = false, fieldOverrides, onClose }: { candidateId: string; group?: string; initialOpen?: boolean; launcherHidden?: boolean; fieldOverrides?: Record<string, string>; onClose?: () => void }) {
  const permissions = useCurrentPermissions();
  const session = useHasSupabaseSession();
  const qc = useQueryClient();
  const kinds = LETTER_GROUPS[group] ?? LETTER_GROUPS.hiring;
  const [kind, setKind] = useState<LetterKind>(kinds[0]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [copy, setCopy] = useState<LetterCopy | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [open, setOpen] = useState(initialOpen);
  const canView = permissions.can("employees", "view");
  const canEdit = permissions.can("employees", "edit");
  const canExport = canView && permissions.canExport("employees");
  const queryKey = ["employment-letter-copies", candidateId] as const;
  const profile = useQuery({
    queryKey: ["employment-letter-profile", candidateId], enabled: session && canView && open,
    queryFn: async () => {
      const [{ data, error }, resolved] = await Promise.all([
        supabase.from("candidates").select("id,full_name,employee_code,candidate_code,preferred_joining_date,present_address1,present_address2,present_city,present_state,present_pincode,offboarding_details,other_info").eq("id", candidateId).single(),
        fetchCandidateForRender(candidateId),
      ]);
      if (error) throw error;
      return employeeLetterFields(data, resolved);
    },
  });
  const history = useQuery({
    queryKey, enabled: session && canView,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_signed_documents").select("id,rendered_body,version,created_at,signed_at,issued_at").eq("candidate_id", candidateId).eq("doc_type", "appointment_letter").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Saved[];
    },
  });
  useEffect(() => {
    if (!copy || !canExport) { setPdf(null); return; }
    let cancelled = false;
    setPdf(null); setPdfBusy(true);
    const timer = setTimeout(() => {
      void letterPdf(copy).then(blob => { if (!cancelled) setPdf(blob); }).catch(e => { if (!cancelled) toast.error(e.message); }).finally(() => { if (!cancelled) setPdfBusy(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [copy, canExport]);
  useEffect(() => {
    if (open && profile.data && !copy) {
      const values = Object.keys(fields).length ? fields : { ...profile.data, ...fieldOverrides };
      setFields(values); setCopy(createLetter(kind, values));
    }
  }, [open, profile.data, copy, fields, kind, fieldOverrides]);

  function previewSize(line: LetterLine, available: number) {
    if (typeof document === "undefined") return line.size;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return line.size;
    return fitLetterLine(line, (value, size, bold, family) => {
      context.font = `${bold ? "bold" : "normal"} ${size * 96 / 72}px ${family === "serif" ? '"Times New Roman"' : "Arial"}`;
      return context.measureText(value).width * 72 / 96;
    }, available);
  }

  function start(selected: LetterKind) {
    setKind(selected); setFields(profile.data ? { ...profile.data, ...fieldOverrides } : {}); setCopy(null); setSavedId(null); setOpen(true);
  }
  async function save(issue = false) {
    if (!copy || !canEdit || !session) return false;
    setBusy(true);
    try {
      // Existing private employee-document RLS and template anchor remain authoritative.
      const template = await fetchActiveTemplate("appointment_letter");
      if (!template) throw new Error("An active Appointment Letter master is required to save this copy.");
      const payload = { candidate_id: candidateId, template_id: template.id, doc_type: "appointment_letter", version: template.version, rendered_body: JSON.stringify(copy), employee_signature_data: "", company_signature_data: "", signed_at: null, issued_at: issue ? new Date().toISOString() : null };
      // Never overwrite an issued/signed document. Each save produces a retained copy.
      const { data, error } = await supabase.from("employee_signed_documents").insert(payload).select("id").single();
      if (error) throw error;
      setSavedId(data.id);
      await logActivity({ module: "Employment Letters", action: "create", entityType: "employee_signed_documents", entityId: data.id, entityLabel: LETTER_LABELS[copy.kind], details: { candidate_id: candidateId, letter_kind: copy.kind } });
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["candidate-signed-docs", candidateId] });
      void qc.invalidateQueries({queryKey:DOCUMENT_FOLLOWUP_QK});
      void qc.invalidateQueries({queryKey:["my-document-followup"]});
      toast.success(issue ? "Issued copy saved — signed return is now pending" : "Letter copy saved to this employee");
      if(issue && permissions.can("recruitment","edit")) {
        const reminder=await supabase.rpc("notify_document_followup",{p_candidate:candidateId});
        if(reminder.error) toast.error("Letter saved; dashboard reminder could not be sent");
        else if(reminder.data?.status==="no_account") toast.info("No employee login exists; share the exported letter directly");
      }
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save letter"); return false; }
    finally { setBusy(false); }
  }
  if (!canView) return null;
  const missing = letterFieldKeys(kind).filter(key => !(fields[key] ?? profile.data?.[key])?.trim());
  return <div className="space-y-4">
    {!launcherHidden && <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold">{group === "exit" ? "Exit Letters" : group === "confirmation" ? "Confirmation Letter" : "Hiring & Rehiring Letters"}</h3>
      <div className="flex flex-wrap gap-2">{kinds.map(item => <Button key={item} variant="outline" size="sm" onClick={() => start(item)}><FileText className="mr-2 h-4 w-4" />{LETTER_LABELS[item]}</Button>)}</div>
    </div>
    {history.error && <p className="text-sm text-destructive">Saved letters could not be loaded.</p>}
    <ul className="divide-y divide-border">{(history.data ?? []).map(row => {
      const item = decodeLetter(row.rendered_body);
      if (!item || !kinds.includes(item.kind)) return null;
      return <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div><span className="text-sm font-medium">{LETTER_LABELS[item.kind]}</span><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-IN")} · {row.issued_at ? "Issued copy" : "Draft copy"}</p></div>
        {canEdit && row.issued_at && <label className="cursor-pointer text-sm font-medium text-primary"><span className="flex items-center gap-2"><Upload className="h-4 w-4"/>Upload signed copy</span><input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>10*1024*1024){toast.error("Each file must be 10 MB or smaller");return;}setBusy(true);try{await uploadFollowupDocument(candidateId,undefined,`signed_${item.kind}`,file,row.id);await Promise.all([qc.invalidateQueries({queryKey:DOCUMENT_FOLLOWUP_QK}),qc.invalidateQueries({queryKey:["document-evidence"]}),qc.invalidateQueries({queryKey:["my-document-followup"]})]);toast.success("Signed copy received");}catch(error){toast.error(error instanceof Error?error.message:"Upload failed");}finally{setBusy(false);}}}/></label>}
        <Button variant="outline" size="sm" onClick={() => { setKind(item.kind); setFields(item.fields); setCopy(item); setSavedId(row.id); setOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Open</Button>
      </li>;
    })}</ul>
    </>}
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) onClose?.(); }}><DialogContent size="document" className="letter-workspace flex flex-col overflow-hidden">
      <DialogHeader><DialogTitle>{LETTER_LABELS[kind]}</DialogTitle></DialogHeader>
      <div className="flex shrink-0 flex-wrap gap-2 pb-1">
        <Select value={kind} onValueChange={value => { setKind(value as LetterKind); setCopy(null); setSavedId(null); }}><SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger><SelectContent>{kinds.map(item => <SelectItem key={item} value={item}>{LETTER_LABELS[item]}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => { setFields({ ...profile.data, ...fieldOverrides }); setCopy(null); setSavedId(null); }}>Fill from employee</Button>
        <Button variant="outline" onClick={() => void save()} disabled={!copy || !canEdit || busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{savedId ? "Save new copy" : "Save copy"}</Button>
        {canEdit && <Button variant="outline" disabled={!copy || busy} onClick={()=>void save(true)}><Send className="mr-2 h-4 w-4"/>Issue for signature</Button>}
        {canExport && <Button variant="outline" disabled={!pdf || pdfBusy || busy} onClick={async () => { if (!pdf || !copy) return; if (group === "exit" && canEdit && !savedId && !(await save())) return; downloadLetter(pdf, `${LETTER_LABELS[copy.kind].replaceAll(" ", "_")}-${fields.employee_code || candidateId}.pdf`); }}><Download className="mr-2 h-4 w-4" />{pdfBusy ? "Preparing PDF…" : "Export PDF"}</Button>}
      </div>
      {profile.isLoading && <p className="text-sm text-muted-foreground">Loading employee details…</p>}
      {profile.error && <p className="text-sm text-destructive">Could not load employee details. Try again.</p>}
      <div className="letter-workspace-body grid min-h-0 flex-1 gap-5 overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:overflow-hidden">
        <div className="min-w-0 md:overflow-y-auto md:pr-2"><div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">{letterFieldKeys(kind).map(key => <div className="min-w-0" key={key}><Label htmlFor={`letter-${key}`}>{LETTER_FIELDS[key] ?? key}</Label><Input id={`letter-${key}`} value={fields[key] ?? profile.data?.[key] ?? ""} onChange={e => { const values = { ...(Object.keys(fields).length ? fields : profile.data), [key]: e.target.value }; setFields(values); setCopy(createLetter(kind, values)); setSavedId(null); }} /></div>)}</div>
          {missing.length > 0 && <p className="text-sm text-muted-foreground">Not recorded: {missing.map(key => LETTER_FIELDS[key] ?? key).join(", ")}. These remain blank.</p>}
          {kind === "appointment" && <p className="text-sm text-muted-foreground">Salary annexure was not supplied. Review employment terms before issuing.</p>}
          {kind === "termination" && <p className="text-sm text-muted-foreground">Review performance statements and the approved reason before issuing.</p>}
          {kind === "resignation" && <p className="text-sm text-muted-foreground">Employee review draft — valid only after the employee confirms and signs it.</p>}
        </div>
        <div className="letter-preview min-h-0 min-w-0 overflow-y-auto bg-muted p-2">
          {copy?.pages.map((page, pi) => <FittedDocument key={pi} fitHeight><div className="employment-letter-page" style={{ width: `${page.width}pt`, height: `${page.height}pt` }}>
            {page.lines.map((line, li) => <div key={li} aria-label={`Page ${pi + 1}, line ${li + 1}`} role="textbox" className={`employment-letter-line ${line.family === "serif" ? "employment-serif" : "employment-sans"}`} style={{ left: `${line.left}pt`, top: `${line.top}pt`, fontSize: `${previewSize(line, page.width - line.left - 65)}pt`, width: `${page.width - line.left - 65}pt` }} contentEditable suppressContentEditableWarning onBlur={e => {
              const value = e.currentTarget.textContent ?? "";
              if (value === line.runs.map(run => run.text).join("")) return;
              setSavedId(null);
              setCopy(previous => { if (!previous) return previous; const next = structuredClone(previous); next.pages[pi].lines[li].runs = [{ text: value, bold: line.runs.every(run => run.bold) }]; return next; });
            }}>{line.runs.map((run, ri) => run.bold ? <strong key={ri}>{run.text}</strong> : <span key={ri}>{run.text}</span>)}</div>)}
          </div></FittedDocument>)}
        </div>
      </div>
    </DialogContent></Dialog>
  </div>;
}