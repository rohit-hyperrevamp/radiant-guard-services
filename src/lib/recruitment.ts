// Recruitment (HR) data layer — non-billable hiring funnel.
// Tables are gated by RLS (`current_user_can_recruit()`): Super Admin, plus any
// role later granted the `recruitment` RBAC module. Interviewers see only their
// own interviews; HR Head onboarding follows workflow 'recruitment_onboarding'.
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const recDb = supabase as unknown as { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any; storage: typeof supabase.storage };

export const REC_MODULE = "Recruitment";
export const REC_BUCKET = "recruitment";
export const PUNE_HOME_UNIT = "0889cfb4-7fd6-44b4-bbac-7d7026e33f0f";

export type RecStage =
  | "new" | "screening" | "round_1" | "round_2" | "round_3" | "hr_approved"
  | "pending_onboarding" | "onboarded" | "rejected" | "withdrawn" | "on_hold";

export const STAGES: { key: RecStage; label: string; tone: string }[] = [
  { key: "new", label: "New", tone: "bg-muted text-foreground" },
  { key: "screening", label: "Screening", tone: "bg-accent/10 text-accent" },
  { key: "round_1", label: "Round 1", tone: "bg-accent/15 text-accent" },
  { key: "round_2", label: "Round 2", tone: "bg-accent/20 text-accent" },
  { key: "round_3", label: "Round 3", tone: "bg-accent/25 text-accent" },
  { key: "hr_approved", label: "HR Approved", tone: "bg-primary/15 text-primary" },
  { key: "pending_onboarding", label: "Pending Onboarding", tone: "bg-primary/20 text-primary" },
  { key: "onboarded", label: "Onboarded", tone: "bg-primary/25 text-primary" },
  { key: "rejected", label: "Rejected", tone: "bg-destructive/15 text-destructive" },
  { key: "withdrawn", label: "Withdrawn", tone: "bg-destructive/10 text-destructive" },
  { key: "on_hold", label: "On Hold", tone: "bg-secondary text-secondary-foreground" },
];
export const PIPELINE: RecStage[] = ["new", "screening", "round_1", "round_2", "round_3", "hr_approved", "pending_onboarding"];
export const LOST: RecStage[] = ["rejected", "withdrawn"];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;
export const stageTone = (k: string) => STAGES.find((s) => s.key === k)?.tone ?? "bg-muted";
export const SOURCES = ["Referral", "Job portal", "LinkedIn", "Walk-in", "Consultant", "Website", "Other"];

export type RecOpening = {
  id: string; title: string; designation_id: string | null; department_id: string | null; branch_id: string | null;
  positions: number; salary_min: number; salary_max: number; description: string; status: string;
  workforce_class: "blue_collar" | "white_collar"; billing_class: "billable" | "non_billable"; created_at: string;
  rec_opening_rounds?: RecRound[];
};
export type RecRound = { id: string; opening_id: string; round_no: number; name: string; default_interviewer_id: string | null };
export type RecOffer = {
  monthly_ctc?: number; monthly_gross?: number; joining_date?: string; designation_id?: string; department_id?: string;
  branch_id?: string; reports_to?: string; unit_id?: string; role_key?: string; notes?: string;
};
export type RecCandidate = {
  id: string; code: string; full_name: string; mobile: string; email: string; current_location: string;
  experience_years: number; current_ctc: number; expected_ctc: number; notice_days: number; source: string;
  referred_by: string; opening_id: string | null; resume_path: string; resume_name: string; stage: RecStage;
  total_rounds: number; rounds_cleared: number; notes: string; lost_reason: string; offer: RecOffer;
  employee_candidate_id: string | null; onboarded_at: string | null; stage_changed_at: string; created_at: string;
  employee_details?: Record<string, string | boolean> | null;
};

/** Fields the recruiter must fill before the offer can go to the HR Head (mirrors rec_send_to_hr_head). */
export const REQUIRED_EMPLOYEE_DETAILS: [string, string][] = [
  ["date_of_birth", "Date of birth"], ["gender", "Gender"], ["aadhaar_number", "Aadhaar"], ["pan_number", "PAN"],
  ["permanent_address1", "Permanent address"], ["permanent_city", "City"], ["permanent_state", "State"], ["permanent_pincode", "Pincode"],
  ["bank_account_number", "Bank account"], ["bank_ifsc", "IFSC"], ["emergency_contact_name", "Emergency contact"], ["emergency_contact_mobile", "Emergency mobile"],
];
export function missingEmployeeDetails(d: RecCandidate["employee_details"]): string[] {
  return REQUIRED_EMPLOYEE_DETAILS.filter(([k]) => !String(d?.[k] ?? "").trim()).map(([, l]) => l);
}
export type RecInterview = {
  id: string; candidate_id: string; round_no: number; round_name: string; interviewer_id: string; scheduled_at: string;
  mode: string; location: string; status: string; feedback: string; rating: number | null; decided_at: string | null; created_by: string | null; created_at: string;
};
export type MyInterview = RecInterview & { rec_candidates: (RecCandidate & { rec_openings?: { title: string } | null }) | null };
export type RecEvent = { id: string; candidate_id: string; event: string; details: string; created_at: string };
export type RecOnboarding = {
  id: string; candidate_id: string; status: string; offer: RecOffer; decided_at: string | null; decision_note: string;
  employee_candidate_id: string | null; created_at: string;
};

export const QK = {
  openings: ["rec", "openings"] as const,
  candidates: ["rec", "candidates"] as const,
  candidate: (id: string) => ["rec", "candidate", id] as const,
  interviews: ["rec", "interviews"] as const,
  myInterviews: ["rec", "my-interviews"] as const,
  onboarding: ["rec", "onboarding"] as const,
  masters: ["rec", "masters"] as const,
};

async function fetchAll<T>(build: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const fetchOpenings = () =>
  fetchAll<RecOpening>(() => recDb.from("rec_openings").select("*, rec_opening_rounds(*)").order("created_at", { ascending: false }));
export const fetchCandidates = () =>
  fetchAll<RecCandidate>(() => recDb.from("rec_candidates").select("*").order("created_at", { ascending: false }));
export const fetchAllInterviews = () =>
  fetchAll<RecInterview>(() => recDb.from("rec_interviews").select("*").order("scheduled_at", { ascending: true }));

export async function fetchCandidate(id: string) {
  const [c, i, e, o] = await Promise.all([
    recDb.from("rec_candidates").select("*").eq("id", id).maybeSingle(),
    recDb.from("rec_interviews").select("*").eq("candidate_id", id).order("round_no").order("created_at"),
    recDb.from("rec_events").select("*").eq("candidate_id", id).order("created_at", { ascending: false }).limit(200),
    recDb.from("rec_onboarding_requests").select("*").eq("candidate_id", id).order("created_at", { ascending: false }),
  ]);
  if (c.error) throw c.error;
  return {
    candidate: c.data as RecCandidate | null,
    interviews: (i.data ?? []) as RecInterview[],
    events: (e.data ?? []) as RecEvent[],
    onboarding: (o.data ?? []) as RecOnboarding[],
  };
}

export async function fetchMyInterviews() {
  const [{ data: cid }, { data: auth }] = await Promise.all([
    supabase.rpc("current_user_candidate_id"),
    supabase.auth.getUser(),
  ]);
  const userId = auth.user?.id;
  if (!cid && !userId) return [] as MyInterview[];
  const scope = [cid ? `interviewer_id.eq.${cid as string}` : "", userId ? `created_by.eq.${userId}` : ""].filter(Boolean).join(",");
  return fetchAll<MyInterview>(() =>
    recDb.from("rec_interviews").select("*, rec_candidates(*, rec_openings(title))").or(scope).order("scheduled_at", { ascending: true }),
  );
}

export const fetchOnboarding = () =>
  fetchAll<RecOnboarding & { rec_candidates: RecCandidate | null }>(() =>
    recDb.from("rec_onboarding_requests").select("*, rec_candidates(*)").order("created_at", { ascending: false }),
  );

export type Masters = {
  designations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  roles: { key: string; name: string }[];
};
export async function fetchMasters(): Promise<Masters> {
  const [d, dp, b, r] = await Promise.all([
    supabase.from("designations").select("id,name").order("name"),
    supabase.from("departments").select("id,name").order("name"),
    supabase.from("branches").select("id,name").order("name"),
    supabase.from("roles").select("key,name").order("name"),
  ]);
  return {
    designations: (d.data ?? []) as Masters["designations"],
    departments: (dp.data ?? []) as Masters["departments"],
    branches: (b.data ?? []) as Masters["branches"],
    roles: (r.data ?? []) as Masters["roles"],
  };
}

export async function employeeNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await supabase.from("candidates").select("id,full_name,employee_code").in("id", uniq.slice(i, i + 200));
    for (const r of data ?? []) map.set(r.id, `${r.full_name}${r.employee_code ? ` (${r.employee_code})` : ""}`);
  }
  return map;
}

export async function uploadResume(candidateId: string, file: File) {
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
  const path = `resumes/${candidateId}/${Date.now()}_${safe}`;
  const { error } = await recDb.storage.from(REC_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  const { error: e2 } = await recDb.from("rec_candidates").update({ resume_path: path, resume_name: file.name }).eq("id", candidateId);
  if (e2) throw e2;
  return path;
}

export async function openResume(path: string) {
  const { data, error } = await recDb.storage.from(REC_BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function addEvent(candidateId: string, event: string, details: string) {
  await recDb.from("rec_events").insert({ candidate_id: candidateId, event, details });
}

export async function notifyEmployee(candidateId: string, title: string, message: string, link: string) {
  try {
    const { data } = await supabase.rpc("get_user_id_by_candidate_id" as never, { _candidate_id: candidateId } as never);
    // Personal type: role-agnostic so assignees without the Recruitment module still see it.
    if (data) await createNotification({ userId: data as unknown as string, type: "interview_assigned", title, message, link });
  } catch (e) {
    console.warn("recruitment notify failed", e);
  }
}

export async function notifyOnboarders(title: string, message: string, link: string) {
  try {
    const { data } = await recDb.rpc("get_recruitment_onboarder_user_ids");
    for (const r of (data ?? []) as { user_id: string }[]) {
      await createNotification({ userId: r.user_id, type: "recruitment", title, message, link }).catch(() => undefined);
    }
  } catch (e) {
    console.warn("recruitment onboarder notify failed", e);
  }
}

export const inr = (n: number | null | undefined) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const monthStartIso = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };
export const PAGE_SIZE = 25;
