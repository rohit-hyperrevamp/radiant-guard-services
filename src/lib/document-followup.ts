export type DocumentPurpose = "onboarding" | "rehire" | "offboarding";
export const PURPOSE_LABELS: Record<DocumentPurpose, string> = { onboarding: "Onboarding", rehire: "Rehire", offboarding: "Offboarding" };
export const DOCUMENT_TYPES: Record<string, string> = {
  photo: "Photograph", aadhaar_front: "Aadhaar front", aadhaar_back: "Aadhaar back", pan: "PAN card", signature: "Employee signature",
  tenth: "10th certificate", twelfth: "12th certificate", graduation: "Graduation certificate", professional: "Professional certificate", birth: "Date-of-birth proof", residence: "Residence proof", bank: "Bank proof", salary_slip: "Previous salary slips", resignation: "Resignation letter", relieving: "Previous relieving letter", experience: "Experience letter", id_card: "Returned ID card copy",
  signed_offer: "Signed Offer Letter", signed_appointment: "Signed Appointment Letter", signed_confirmation: "Signed Confirmation Letter", signed_termination: "Signed Termination Letter", signed_experience: "Signed Experience Cum Relieving Letter", signed_relieving: "Signed Relieving Letter",
  signed_resignation: "Signed Resignation Letter",
};
export const DETAIL_TYPES: Record<string, string> = {
  aadhaar_number: "Aadhaar number", pan_number: "PAN number", bank_account: "Bank account number", bank_ifsc: "Bank IFSC", bank_name: "Bank name", date_of_birth: "Date of birth", mobile: "Mobile number", present_address: "Present address", permanent_address: "Permanent address", emergency_contact: "Emergency contact", last_working_date: "Last working date", exit_reason: "Exit reason",
};
export type DocumentStatusFilter = "active" | "inactive" | "all";
export function missingDocumentDetails(employee: Record<string, any>, required: string[]): string[] {
  const fields: Record<string, unknown> = {
    aadhaar_number: employee.aadhaar_number, pan_number: employee.pan_number,
    bank_account: employee.bank_account_number, bank_ifsc: employee.bank_ifsc, bank_name: employee.bank_name,
    date_of_birth: employee.date_of_birth, mobile: employee.mobile,
    present_address: employee.present_address1, permanent_address: employee.permanent_address1,
    emergency_contact: employee.emergency_contact_mobile,
    last_working_date: employee.offboarding_details?.date_of_last_working,
    exit_reason: employee.offboarding_details?.reason_text,
  };
  return required.filter(key => !String(fields[key] ?? "").trim());
}
export type DocumentDatePeriod = "all" | "6months" | "1year" | "2years" | "custom";
export type DocumentDateRange = { from: string | null; to: string | null; valid: boolean };
/** Filter by joining/rehire/exit action date, not employee age or days overdue. */
export function documentDateRange(period: DocumentDatePeriod, today: string, from = "", to = ""): DocumentDateRange {
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  if (period === "all") return { from: null, to: null, valid: true };
  if (period === "custom") return { from: from || null, to: to || null, valid: isDate(from) && isDate(to) && from <= to };
  if (!isDate(today)) return { from: null, to: null, valid: false };
  const date = new Date(`${today}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - (period === "6months" ? 6 : period === "1year" ? 12 : 24));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return { from: date.toISOString().slice(0, 10), to: today, valid: true };
}
/** Plain message HR can send to the employee listing everything still needed. */
export function followupRequestText(name: string, missing: string[], details: string[], due: string | null): string {
  const lines = [`Dear ${name},`, "", "Please share the following pending items with HR:"];
  for (const k of details) lines.push(`- ${DETAIL_TYPES[k] ?? k}`);
  for (const k of missing) lines.push(`- ${DOCUMENT_TYPES[k] ?? k} (copy)`);
  if (due) lines.push("", `Please submit by ${due}.`);
  return lines.join("\n");
}
export type DocumentPolicy = { purpose: DocumentPurpose; required_keys: string[]; required_details?: string[]; deadline_days: number; owner_candidate_id: string | null };
export type DocumentPerson = {
  id: string; recId?: string; name: string; code: string; purpose: DocumentPurpose; start: string | null;
  received: string[]; missing: string[]; missingDetails?: string[]; active?: boolean; due: string | null; overdue: boolean;
};
export function documentEvidence(employee: Record<string, any>): string[] {
  const keys = new Set<string>();
  const urls: Record<string, string> = { photo: "photo_url", aadhaar_front: "aadhaar_image_url", aadhaar_back: "aadhaar_back_image_url", pan: "pan_image_url", signature: "signature_url" };
  for (const [key, property] of Object.entries(urls)) if (employee[property]) keys.add(key);
  if (employee.other_info?.digilocker_verified || employee.other_info?.digilocker_verified_aadhaar) { keys.add("aadhaar_front"); keys.add("aadhaar_back"); }
  for (const doc of employee.documents ?? []) {
    if (!doc?.file_url && !doc?.url && !doc?.file_path) continue;
    const key = doc.document_key ?? doc.category;
    if (key && DOCUMENT_TYPES[key]) keys.add(key);
  }
  for (const doc of employee.offboarding_details?.exit_documents ?? []) {
    if (!doc.file_url || doc.collected === false) continue;
    if (doc.key === "resignation_letter") keys.add("resignation");
    if (doc.key === "id_card_photo") keys.add("id_card");
  }
  return [...keys];
}
export const REC_CATEGORY_KEYS: Record<string, string> = { "10th_certificate": "tenth", "12th_certificate": "twelfth", graduation_certificate: "graduation", salary_slip: "salary_slip", resignation_letter: "resignation", relieving_letter: "relieving", experience_letter: "experience" };
export function documentStatus(input: Omit<DocumentPerson, "missing" | "due" | "overdue">, policy: DocumentPolicy, today: string): DocumentPerson {
  const received = [...new Set(input.received)];
  const missing = policy.required_keys.filter(key => !received.includes(key));
  let due: string | null = null;
  if (input.start && /^\d{4}-\d{2}-\d{2}/.test(input.start)) {
    const d = new Date(`${input.start.slice(0, 10)}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) { d.setUTCDate(d.getUTCDate() + policy.deadline_days); due = d.toISOString().slice(0, 10); }
  }
  return { ...input, received, missing, due, overdue: (missing.length > 0 || (input.missingDetails?.length ?? 0) > 0) && due !== null && due < today };
}