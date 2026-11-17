import { downloadLetter } from "@/lib/employment-letters";
import { useRef, useState } from "react";
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

export function DocumentChecklist({ id, recId, purpose = "onboarding", employee, start }: { id?: string; recId?: string; purpose?: DocumentPurpose; employee?: Record<string, any>; start?: string | null }) {
  const session = useHasSupabaseSession(); const permissions = useCurrentPermissions(); const qc = useQueryClient();
  const [downloads,setDownloads] = useState<Record<string,Blob>>({});
  const [busy,setBusy] = useState<string|null>(null); const refs = useRef<Record<string,HTMLInputElement|null>>({});
  const policies = useQuery({ queryKey: ["document-policies"], queryFn: fetchDocumentPolicies, enabled: session });
  const evidence = useQuery({ queryKey: ["document-evidence",id,recId], queryFn: () => fetchPersonDocumentEvidence(id ?? recId ?? "",recId), enabled: session && Boolean(id || recId), refetchOnWindowFocus: true });
  const policy = policies.data?.find(p => p.purpose === purpose);
  if (!policy) return policies.error ? <p className="text-sm text-destructive">Document requirements could not be loaded.</p> : null;
  const pendingDetails = employee ? missingDocumentDetails(employee, policy.required_details ?? []) : [];
  const status = documentStatus({ id: id ?? recId ?? "", name: "", code:"", purpose, missingDetails: pendingDetails, start: start ?? (purpose === "offboarding" ? employee?.offboarding_details?.date_of_offboarding ?? employee?.offboarded_at : employee?.preferred_joining_date) ?? null, received: [...(evidence.data?.evidence ?? []), ...(employee ? documentEvidence(employee) : [])] },policy,new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}));
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
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Required documents · {status.received.filter(k=>policy.required_keys.includes(k)).length}/{policy.required_keys.length} received</h3><span className={status.overdue ? "text-sm font-semibold text-destructive" : "text-sm text-muted-foreground"}>{status.missing.length} pending</span></div>
    {status.missing.length > 0 && <p className={status.overdue ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{status.due ? `${status.overdue ? "Overdue — submit by" : "Submit by"} ${status.due} (${policy.deadline_days} days from ${purpose === "offboarding" ? "exit" : purpose === "rehire" ? "rehire request" : "joining"}).` : `Submit within ${policy.deadline_days} days of ${purpose === "offboarding" ? "exit" : purpose === "rehire" ? "the rehire request" : "joining"}; the date is not recorded yet.`}</p>}
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{policy.required_keys.map(key=><div key={key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-2"><span className="flex min-w-0 items-center gap-2 text-sm">{!status.missing.includes(key)&&<Check className="h-4 w-4 shrink-0 text-primary"/>}{DOCUMENT_TYPES[key] ?? key}</span><span className="text-xs text-muted-foreground">{status.missing.includes(key)?"Pending":"Received"}</span>{permissions.can("recruitment","edit") && (id || recId) && <><Button size="icon" variant="outline" title={`Upload ${DOCUMENT_TYPES[key]}`} aria-label={`Upload ${DOCUMENT_TYPES[key]}`} disabled={busy!==null} onClick={()=>refs.current[key]?.click()}>{busy===key?<Loader2 className="h-4 w-4 animate-spin"/>:<Upload className="h-4 w-4"/>}</Button><input ref={node=>{refs.current[key]=node;}} className="hidden" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={e=>void upload(key,e.target.files?.[0])}/></>}</div>)}</div>
    {(evidence.data?.receipts ?? []).map((receipt:any)=><div className="flex items-center justify-between gap-2 text-sm" key={receipt.id}><span className="break-all">{receipt.file_name}</span>{permissions.canExport("recruitment")&&<Button variant="ghost" size="icon" aria-label={`Download ${receipt.file_name}`} title={downloads[receipt.id]?"Download file":"Prepare download"} onClick={()=>{const blob=downloads[receipt.id];if(blob){downloadLetter(blob,receipt.file_name);return;}void downloadFollowupDocument(receipt.file_path,receipt.file_name).then(data=>{setDownloads(previous=>({...previous,[receipt.id]:data}));toast.success("File ready — click Download to save");}).catch(()=>toast.error("Could not download document"));}}><Download className="h-4 w-4"/></Button>}<Button variant="ghost" size="icon" aria-label={`View ${receipt.file_name}`} onClick={async()=>{const tab=window.open("","_blank");try{const {data,error}=await recDb.storage.from(REC_BUCKET).createSignedUrl(receipt.file_path,60);if(error)throw error;if(tab)tab.location.href=data.signedUrl;}catch(e){tab?.close();toast.error("Could not open document");}}}><ExternalLink className="h-4 w-4"/></Button></div>)}
    {evidence.error && <p className="text-sm text-destructive">Received documents could not be loaded; counts may be incomplete.</p>}
  </section>;
}