import { recDb, fetchCandidateDocuments, REC_BUCKET } from "@/lib/recruitment";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { documentEvidence, REC_CATEGORY_KEYS, type DocumentPolicy, type DocumentPerson, type DocumentPurpose } from "./document-followup";

export const DOCUMENT_FOLLOWUP_QK = ["document-followup"] as const;
export async function fetchDocumentPolicies(): Promise<DocumentPolicy[]> {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load document policies.");
  const { data, error } = await recDb.from("employee_document_policies").select("*").order("purpose");
  if (error) throw error;
  return data ?? [];
}
export type DocumentSummary = { people: number; overdue: number; exits: number; exitOverdue: number; types: Record<string, number>; details: Record<string, number> };
/** Dashboard overview: counts only, computed in the database (document_followup_summary). */
export async function fetchDocumentSummary(status: string = "active", from: string | null = null, to: string | null = null): Promise<DocumentSummary> {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load pending documents.");
  const { data, error } = await (recDb as any).rpc("document_followup_summary", { p_status: status, p_from: from, p_to: to });
  if (error) throw error;
  return { people: Number(data?.people ?? 0), overdue: Number(data?.overdue ?? 0), exits: Number(data?.exits ?? 0), exitOverdue: Number(data?.exit_overdue ?? 0), types: data?.types ?? {}, details: data?.details ?? {} };
}
export type DocumentListFilters = { type: string; purpose: string; overdue: boolean; words: string[]; page: number; status: string; from: string | null; to: string | null };
export const DOCUMENT_PAGE_SIZE = 15;
/** One filtered page of people with missing files, filtered and paged in the database (document_followup_list). */
export async function fetchDocumentList(f: DocumentListFilters): Promise<{ total: number; rows: DocumentPerson[] }> {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load pending documents.");
  const { data, error } = await (recDb as any).rpc("document_followup_list", {
    p_type: f.type === "all" ? null : f.type, p_purpose: f.purpose === "all" ? null : f.purpose, p_overdue: f.overdue,
    p_words: f.words, p_offset: f.page * DOCUMENT_PAGE_SIZE, p_limit: DOCUMENT_PAGE_SIZE, p_status: f.status, p_from: f.from, p_to: f.to,
  });
  if (error) throw error;
  const rows: DocumentPerson[] = (data?.rows ?? []).map((r: any) => ({
    id: r.id, recId: r.rec_id ?? undefined, name: r.full_name ?? "", code: r.code ?? "", purpose: r.purpose as DocumentPurpose,
    start: r.start_date ?? null, received: [], missing: r.missing ?? [], missingDetails: r.missing_details ?? [], active: r.active !== false, due: r.due ?? null, overdue: !!r.overdue,
  }));
  return { total: Number(data?.total ?? 0), rows };
}
export async function fetchPersonDocumentEvidence(id: string, recId?: string) {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load documents.");
  const { data, error } = await recDb.from("employee_document_receipts").select("*").eq(recId ? "rec_candidate_id" : "candidate_id", recId || id).order("created_at", { ascending: false });
  if (error) throw error;
  let evidence: string[] = (data ?? []).map((row: any) => row.document_key);
  if (recId) {
    const docs = await fetchCandidateDocuments(recId);
    evidence.push(...docs.filter(d => d.file_path).map(d => REC_CATEGORY_KEYS[d.category]).filter(Boolean));
  } else {
    const { data: employee, error: e } = await recDb.from("candidates").select("photo_url,aadhaar_image_url,aadhaar_back_image_url,pan_image_url,signature_url,documents,other_info,offboarding_details").eq("id",id).single();
    if (e) throw e;
    evidence.push(...documentEvidence(employee));
    const { data: linked, error: linkedError } = await recDb.from("rec_candidates").select("id").eq("employee_candidate_id",id);
    if (linkedError) throw linkedError;
    for (const rec of linked ?? []) {
      const [documents, linkedReceipts] = await Promise.all([
        fetchCandidateDocuments(rec.id),
        recDb.from("employee_document_receipts").select("*").eq("rec_candidate_id",rec.id),
      ]);
      if (linkedReceipts.error) throw linkedReceipts.error;
      evidence.push(...documents.filter(d=>d.file_path).map(d=>REC_CATEGORY_KEYS[d.category]).filter(Boolean));
      evidence.push(...(linkedReceipts.data??[]).map((r:any)=>r.document_key));
      data?.push(...(linkedReceipts.data??[]));
    }
    const { data: rehires, error: rehireError } = await recDb.from("rehire_requests").select("resignation_url,id_card_url").or(`previous_candidate_id.eq.${id},new_candidate_id.eq.${id}`).not("status","in","(rejected,cancelled)");
    if (rehireError) throw rehireError;
    for(const rehire of rehires??[]){if(rehire.resignation_url)evidence.push("resignation");if(rehire.id_card_url)evidence.push("id_card");}
  }
  return { evidence: [...new Set(evidence)], receipts: data ?? [] };
}
export async function uploadFollowupDocument(id: string, recId: string | undefined, key: string, file: File) {
  const path = `followup/${recId || id}/${key}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g,"_")}`;
  const { error } = await recDb.storage.from(REC_BUCKET).upload(path,file,{ contentType: file.type || undefined, upsert:false });
  if (error) throw error;
  const { data, error: saveError } = await recDb.from("employee_document_receipts").insert({ candidate_id: recId ? null : id, rec_candidate_id: recId || null, document_key:key, file_path:path, file_name:file.name }).select("id").single();
  if (saveError) { await recDb.storage.from(REC_BUCKET).remove([path]); throw saveError; }
  return data;
}