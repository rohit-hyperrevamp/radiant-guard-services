import { recDb, fetchCandidates, fetchCandidateDocuments, REC_BUCKET } from "@/lib/recruitment";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { documentEvidence, documentStatus, REC_CATEGORY_KEYS, type DocumentPolicy, type DocumentPerson } from "./document-followup";

export const DOCUMENT_FOLLOWUP_QK = ["document-followup"] as const;
async function all(table: string, columns: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await recDb.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
export async function fetchDocumentPolicies(): Promise<DocumentPolicy[]> {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load document policies.");
  const { data, error } = await recDb.from("employee_document_policies").select("*").order("purpose");
  if (error) throw error;
  return data ?? [];
}
export async function fetchDocumentFollowup(): Promise<{ policies: DocumentPolicy[]; people: DocumentPerson[] }> {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load pending documents.");
  const [policies, employees, recruits, receipts, recDocs, rehires] = await Promise.all([
    fetchDocumentPolicies(),
    all("candidates", "id,full_name,employee_code,candidate_code,status,is_enabled,preferred_joining_date,created_at,photo_url,aadhaar_image_url,aadhaar_back_image_url,pan_image_url,signature_url,documents,other_info,offboarding_details,onboarding_details,offboarded_at"),
    fetchCandidates(), all("employee_document_receipts", "id,candidate_id,rec_candidate_id,document_key,file_path"),
    all("rec_candidate_documents", "id,candidate_id,category,file_path"),
    all("rehire_requests", "id,previous_candidate_id,new_candidate_id,created_at,status,resignation_url,id_card_url"),
  ]);
  const byEmployee = new Map<string, string[]>(); const byRec = new Map<string, string[]>();
  for (const receipt of receipts) {
    const map = receipt.candidate_id ? byEmployee : byRec; const id = receipt.candidate_id || receipt.rec_candidate_id;
    map.set(id, [...(map.get(id) ?? []), receipt.document_key]);
  }
  for (const doc of recDocs) if (doc.file_path && REC_CATEGORY_KEYS[doc.category]) byRec.set(doc.candidate_id, [...(byRec.get(doc.candidate_id) ?? []), REC_CATEGORY_KEYS[doc.category]]);
  const byLinked = new Map(recruits.filter(r => r.employee_candidate_id).map(r => [r.employee_candidate_id, r]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const people: DocumentPerson[] = [];
  function add(person: Omit<DocumentPerson, "missing" | "due" | "overdue">) {
    const policy = policies.find(p => p.purpose === person.purpose);
    if (policy) people.push(documentStatus(person, policy, today));
  }
  for (const employee of employees) {
    const rec = byLinked.get(employee.id);
    const evidence = [...documentEvidence(employee), ...(byEmployee.get(employee.id) ?? []), ...(rec ? byRec.get(rec.id) ?? [] : [])];
    if (employee.status !== "inactive" && employee.is_enabled !== false) add({ id: employee.id, recId: rec?.id, name: employee.full_name, code: employee.employee_code || employee.candidate_code || "", purpose: "onboarding", start: employee.preferred_joining_date ?? rec?.onboarded_at ?? null, received: evidence });
    const exit = employee.offboarding_details ?? {};
    if (exit.date_of_offboarding || employee.offboarded_at || exit.collection_status === "pending") add({ id: employee.id, name: employee.full_name, code: employee.employee_code || employee.candidate_code || "", purpose: "offboarding", start: exit.date_of_offboarding ?? employee.offboarded_at ?? exit.collection_requested_at ?? null, received: evidence });
    const rehire = rehires.filter(r => r.previous_candidate_id === employee.id || r.new_candidate_id === employee.id).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
    if (rehire && !["rejected","cancelled"].includes(rehire.status) && employee.id === (rehire.new_candidate_id || rehire.previous_candidate_id)) add({ id: employee.id, name: employee.full_name, code: employee.employee_code || "", purpose: "rehire", start: rehire.created_at, received: [...evidence, ...(rehire.resignation_url ? ["resignation"] : []), ...(rehire.id_card_url ? ["id_card"] : [])] });
  }
  for (const rec of recruits) if (!rec.employee_candidate_id && !["rejected","withdrawn"].includes(rec.stage)) add({ id: rec.id, recId: rec.id, name: rec.full_name, code: rec.code, purpose: "onboarding", start: rec.offer?.joining_date || null, received: byRec.get(rec.id) ?? [] });
  return { policies, people };
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