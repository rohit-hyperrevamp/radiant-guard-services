import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, FileClock, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recDb as supabase } from "@/lib/recruitment";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { DOCUMENT_TYPES, DETAIL_TYPES } from "@/lib/document-followup";
import { decodeLetter, letterPdf, downloadLetter } from "@/lib/employment-letters";
import { uploadFollowupDocument, DOCUMENT_FOLLOWUP_QK } from "@/lib/document-followup-data";

type Issued = {id:string;candidate_id:string;rendered_body:string;issued_at:string;blob:Blob|null};
type Pending = { id: string; purpose: string; start_date:string|null; missing: string[]; missing_details: string[]; due: string | null };
export function MyDocumentFollowup() {
  const session = useHasSupabaseSession(); const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const pending = useQuery({ queryKey: ["my-document-followup"], enabled: session, refetchOnWindowFocus: true, queryFn: async () => {
    const { data, error } = await supabase.rpc("my_document_followup"); if (error) throw error;
    return (data ?? []) as Pending[];
  }});
  const letters = useQuery({ queryKey: ["my-issued-letters"], enabled: session, queryFn: async () => {
    const { data: id, error: idError } = await supabase.rpc("current_user_candidate_id"); if (idError) throw idError;
    if (!id) return [];
    const { data, error } = await supabase.from("employee_signed_documents").select("id,candidate_id,rendered_body,issued_at").eq("candidate_id", id).not("issued_at", "is", null).order("issued_at", { ascending: false });
    if (error) throw error;
    return Promise.all((data ?? []).map(async (row:Omit<Issued,"blob">)=>{const copy=decodeLetter(row.rendered_body);return {...row,blob:copy?await letterPdf(copy):null};}));
  }});
  if (!session) return null;
  const rows = pending.data ?? [];
  if (!pending.isLoading && !pending.error && rows.length === 0) return null;
  return <section className="space-y-3 border-y border-border py-4" aria-label="My pending documents and details">
    <h2 className="flex items-center gap-2 font-semibold"><FileClock className="h-5 w-5 text-primary"/>Your documents & details pending</h2>
    {pending.error ? <p className="text-sm text-destructive">Your checklist could not be loaded.</p> : pending.isLoading ? <p className="text-sm text-muted-foreground">Loading your checklist…</p> : rows.map((row, index) => <div key={`${row.purpose}-${index}`} className="space-y-2">
      <p className="text-sm font-medium capitalize">{row.purpose}{row.due ? ` · Submit by ${row.due}` : ""}</p>
      {row.missing_details.length > 0 && <p className="text-sm text-destructive">Share with Radiant HR: {row.missing_details.map(k=>DETAIL_TYPES[k]??k).join(", ")}</p>}
      {row.missing.map(key => {
        const issued = letters.data?.filter(l=>decodeLetter(l.rendered_body)?.kind===key.replace("signed_", "") && (!row.start_date || new Date(l.issued_at).getTime()===new Date(row.start_date).getTime())) ?? [];
        const copies = key.startsWith("signed_") ? issued : [null];
        return copies.map(letter => <div key={`${key}-${letter?.id ?? "file"}`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>{DOCUMENT_TYPES[key]??key}{letter?.issued_at ? ` · ${new Date(letter.issued_at).toLocaleDateString("en-IN")}` : ""}</span>
          <div className="flex gap-2">{letter && <Button variant="outline" size="sm" disabled={busy!==null} onClick={()=>{const copy=decodeLetter(letter.rendered_body);if(copy&&letter.blob)downloadLetter(letter.blob,`${copy.kind}.pdf`);}}><Download className="h-4 w-4 mr-2"/>Download letter</Button>}
          <Button variant="outline" size="sm" disabled={busy!==null} onClick={()=>refs.current[`${key}-${letter?.id??index}`]?.click()}><Upload className="h-4 w-4 mr-2"/>Upload{letter?" signed copy":""}</Button>
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" ref={node=>{refs.current[`${key}-${letter?.id??index}`]=node;}} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>10*1024*1024){toast.error("Each file must be 10 MB or smaller");return;}setBusy(key);try{await uploadFollowupDocument(row.id,undefined,key,file,letter?.id);await Promise.all([qc.invalidateQueries({queryKey:["my-document-followup"]}),qc.invalidateQueries({queryKey:DOCUMENT_FOLLOWUP_QK}),qc.invalidateQueries({queryKey:["document-evidence"]})]);toast.success("Document received");}catch(error){toast.error(error instanceof Error?error.message:"Upload failed");}finally{setBusy(null);}}}/></div>
        </div>);
      })}
    </div>)}
    {letters.error && <p className="text-sm text-destructive">Issued letters could not be loaded.</p>}
    <Button asChild variant="link" className="px-0"><Link to="/admin/profile">Open my profile</Link></Button>
  </section>;
}