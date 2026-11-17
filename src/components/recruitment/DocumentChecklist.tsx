import { downloadLetter } from "@/lib/employment-letters";
import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Upload, Loader2, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { logActivity } from "@/lib/activity-log";
import { recDb, REC_BUCKET } from "@/lib/recruitment";
import { DOCUMENT_TYPES, DETAIL_TYPES, missingDocumentDetails, documentEvidence, documentStatus, type DocumentPurpose } from "@/lib/document-followup";
import { fetchDocumentPolicies, fetchPersonDocumentEvidence, uploadFollowupDocument, downloadFollowupDocument, DOCUMENT_FOLLOWUP_QK } from "@/lib/document-followup-data";

export function DocumentChecklist({ id, recId, purpose = "onboarding", employee, start, documentOptions }: { id?: string; recId?: string; purpose?: DocumentPurpose; employee?: Record<string, any>; start?: string | null; documentOptions?: Record<string, { label: string; actions: ReactNode; history: ReactNode }> }) {
  const session = useHasSupabaseSession(); const permissions = useCurrentPermissions(); const qc = useQueryClient();
  const [downloads,setDownloads] = useState<Record<string,Blob>>({});
  const [busy,setBusy] = useState<string|null>(null); const refs = useRef<Record<string,HTMLInputElement|null>>({});
  const policies = useQuery({ queryKey: ["document-policies"], queryFn: fetchDocumentPolicies, enabled: session });
  const evidence = useQuery({ queryKey: ["document-evidence",id,recId], queryFn: () => fetchPersonDocumentEvidence(id ?? recId ?? "",recId), enabled: session && Boolean(id || recId), refetchOnWindowFocus: true });
  const policy = policies.data?.find(p => p.purpose === purpose);
  if (!policy) return policies.error ? <p className="text-sm text-destructive">Document requirements could not be loaded.</p> : null;
  const pendingDetails = employee ? missingDocumentDetails(employee, policy.required_details ?? []) : [];
  const status = documentStatus({ id: id ?? recId ?? "", name: "", code:"", purpose, missingDetails: pendingDetails, start: start ?? (purpose === "offboarding" ? employee?.offboarding_details?.date_of_offboarding ?? employee?.offboarded_at : employee?.preferred_joining_date) ?? null, received: [...(evidence.data?.evidence ?? []), ...(employee ? documentEvidence(employee) : [])] },policy,new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}));
  const keys = [...new Set([...Object.keys(documentOptions ?? {}), ...policy.required_keys])];
  const labelFor = (key: string) => documentOptions?.[key]?.label ?? DOCUMENT_TYPES[key] ?? key;
  const receiptRow = (receipt: any) => <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm" key={receipt.id}><span className="min-w-0 break-all">{receipt.file_name}</span><div className="flex shrink-0 gap-2">{permissions.canExport("recruitment") && <Button variant="ghost" size="icon" aria-label={`Download ${receipt.file_name}`} title={`Download ${receipt.file_name}`} disabled={busy === receipt.id} onClick={async () => { setBusy(receipt.id); try { const blob = downloads[receipt.id] ?? await downloadFollowupDocument(receipt.file_path,receipt.file_name); setDownloads(previous=>({...previous,[receipt.id]:blob})); downloadLetter(blob,receipt.file_name); } catch { toast.error("Could not download document"); } finally { setBusy(null); } }}><Download className="h-4 w-4"/></Button>}<Button variant="ghost" size="icon" title={`Preview ${receipt.file_name}`} aria-label={`Preview ${receipt.file_name}`} onClick={async()=>{const tab=window.open("","_blank");try{const {data,error}=await recDb.storage.from(REC_BUCKET).createSignedUrl(receipt.file_path,60);if(error)throw error;if(tab)tab.location.href=data.signedUrl;}catch{tab?.close();toast.error("Could not open document");}}}><ExternalLink className="h-4 w-4"/></Button></div></div>;
  async function upload(key:string,file:File|undefined) {
    if (!file || !id && !recId) return;
    if (file.size > 10*1024*1024) { toast.error("Each file must be 10 MB or smaller"); return; }
    setBusy(key);
    try {
      const saved=await uploadFollowupDocument(id ?? recId ?? "",recId,key,file);
      void logActivity({ module:"Recruitment Documents",action:"create",entityType:"employee_document_receipts",entityId:saved.id,entityLabel:DOCUMENT_TYPES[key] });
      await Promise.all([qc.invalidateQueries({queryKey:DOCUMENT_FOLLOWUP_QK}),qc.invalidateQueries({queryKey:["document-evidence"]}),qc.invalidateQueries({queryKey:["rec"]})]);
      toast.success("Document received");
    } catch(e) {toast.error(e instanceof Error ? e.message : "Upload failed");} finally {setBusy(null);}
  }
  return <section className="space-y-3 py-4">
    {pendingDetails.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold">Pending details</h3><ul className="flex flex-wrap gap-3 text-sm text-destructive">{pendingDetails.map(key => <li key={key}>{DETAIL_TYPES[key] ?? key}</li>)}</ul></div>}
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{documentOptions ? "Offboarding documents" : "Required documents"} · {status.received.filter(k=>policy.required_keys.includes(k)).length}/{policy.required_keys.length} required received</h3><span className={status.overdue ? "text-sm font-semibold text-destructive" : "text-sm text-muted-foreground"}>{status.missing.length} pending</span></div>
    {status.missing.length > 0 && <p className={status.overdue ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{status.due ? `${status.overdue ? "Overdue — submit by" : "Submit by"} ${status.due} (${policy.deadline_days} days from ${purpose === "offboarding" ? "exit" : purpose === "rehire" ? "rehire request" : "joining"}).` : `Submit within ${policy.deadline_days} days of ${purpose === "offboarding" ? "exit" : purpose === "rehire" ? "the rehire request" : "joining"}; the date is not recorded yet.`}</p>}
    <div className={documentOptions ? "divide-y divide-border" : "grid gap-x-6 gap-y-2 sm:grid-cols-2"}>{keys.map(key=><div key={key} className="min-w-0 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2 text-sm">{status.received.includes(key)&&<Check className="h-4 w-4 shrink-0 text-primary"/>}<span>{labelFor(key)}</span><span className="text-xs text-muted-foreground">{policy.required_keys.includes(key) ? status.missing.includes(key) ? "Required · pending" : "Received" : "Optional"}</span></div><div className="flex flex-wrap items-center gap-2">{documentOptions?.[key]?.actions}{permissions.can("recruitment","edit") && (id || recId) && <><Button size="icon" variant="outline" title={`Upload ${labelFor(key)}`} aria-label={`Upload ${labelFor(key)}`} disabled={busy!==null} onClick={()=>refs.current[key]?.click()}>{busy===key?<Loader2 className="h-4 w-4 animate-spin"/>:<Upload className="h-4 w-4"/>}</Button><input ref={node=>{refs.current[key]=node;}} className="hidden" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={e=>{void upload(key,e.target.files?.[0]);e.target.value="";}}/></>}</div></div>{documentOptions?.[key]?.history}{documentOptions && (evidence.data?.receipts ?? []).filter((receipt:any)=>receipt.document_key===key || receipt.document_key===`signed_${key}`).map(receiptRow)}</div>)}</div>
    {(evidence.data?.receipts ?? []).filter((receipt:any)=>!documentOptions || !keys.some(key=>receipt.document_key===key || receipt.document_key===`signed_${key}`)).map(receiptRow)}
    {evidence.error && <p className="text-sm text-destructive">Received documents could not be loaded; counts may be incomplete.</p>}
  </section>;
}