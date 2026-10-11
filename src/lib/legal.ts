// Case Desk shared data: courts, parties, advocates, clients, states and legal notice templates.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Court = { id: string; name: string; court_type: string; state: string; city: string };
export type Party = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
};
export type Advocate = {
  id: string;
  name: string;
  kind: "in_house" | "retainer";
  phone: string | null;
  email: string | null;
  firm: string | null;
  bar_council_no: string | null;
  address: string | null;
  engaged_on: string | null;
  is_active: boolean;
  notes: string;
};
export type Customer = {
  id: string;
  name: string;
  code: string | null;
  billing_name: string | null;
  billing_address1: string | null;
  billing_address2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  billing_email: string | null;
  billing_phone: string | null;
};
export type OrgInfo = {
  company_name: string | null;
  corporate_address: string | null;
  registered_address: string | null;
  email: string | null;
  phone: string | null;
};

export const customerAddress = (c: Partial<Customer>) =>
  [c.billing_address1, c.billing_address2, c.billing_city, c.billing_state, c.billing_pincode]
    .filter((x) => x && String(x).trim())
    .join(", ");

export const LEGAL_MASTERS_KEY = ["legal-masters"];

export function useLegalMasters() {
  return useQuery({
    queryKey: LEGAL_MASTERS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [courts, parties, advocates, customers, states, org] = await Promise.all([
        db.from("legal_courts").select("id,name,court_type,state,city").eq("is_active", true).order("sort_order").order("name").limit(2000),
        db.from("legal_parties").select("id,name,address,city,state,phone,email,gstin").order("name").limit(5000),
        db.from("legal_advocates").select("*").order("name"),
        db
          .from("customers")
          .select("id,name,code,billing_name,billing_address1,billing_address2,billing_city,billing_state,billing_pincode,billing_email,billing_phone")
          .order("name")
          .limit(5000),
        db.from("indian_states").select("name").eq("enabled", true).order("name"),
        db.from("org_settings").select("company_name,corporate_address,registered_address,email,phone").limit(1).maybeSingle(),
      ]);
      return {
        courts: (courts.data ?? []) as Court[],
        parties: (parties.data ?? []) as Party[],
        advocates: (advocates.data ?? []) as Advocate[],
        customers: (customers.data ?? []) as Customer[],
        states: Array.from(new Set(((states.data ?? []) as { name: string }[]).map((s) => s.name))),
        org: (org.data ?? null) as OrgInfo | null,
      };
    },
  });
}

/** Find a saved party by name (case-insensitive) or save a new one. */
export async function ensureParty(name: string, extra: Partial<Party> = {}): Promise<string> {
  const n = name.trim();
  const found = await db.from("legal_parties").select("id").ilike("name", n.replace(/[%_]/g, "\\$&")).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const { data, error } = await db
    .from("legal_parties")
    .insert({ name: n, state: extra.state ?? "", address: extra.address ?? "", city: extra.city ?? "" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function ensureAdvocate(name: string, kind: Advocate["kind"] = "retainer"): Promise<string> {
  const n = name.trim();
  const found = await db.from("legal_advocates").select("id").ilike("name", n.replace(/[%_]/g, "\\$&")).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const { data, error } = await db.from("legal_advocates").insert({ name: n, kind }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function ensureCourt(name: string, state = ""): Promise<string> {
  const n = name.trim();
  const found = await db.from("legal_courts").select("id").eq("name", n).eq("state", state).eq("city", "").maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const { data, error } = await db
    .from("legal_courts")
    .insert({ name: n, state, court_type: "Other", sort_order: 900 })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// ---------------- Legal notice templates ----------------
export type NoticeCtx = {
  company: string;
  toName: string;
  amount?: number | null;
  deadline?: number | null;
  employee?: string;
  caseRef?: string;
};

const rs = (n?: number | null) =>
  n != null && !Number.isNaN(n) ? `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}/-` : "Rs. ________/-";

export const NOTICE_TEMPLATES: {
  key: string;
  label: string;
  subject: (c: NoticeCtx) => string;
  body: (c: NoticeCtx) => string;
}[] = [
  {
    key: "payment_recovery",
    label: "Recovery of outstanding dues",
    subject: (c) => `Legal notice for recovery of outstanding amount of ${rs(c.amount)}`,
    body: (c) =>
      `Under instructions from and on behalf of my client, ${c.company}, I hereby serve upon you the following legal notice:

1. That my client is engaged in the business of providing security and facility management services and has rendered such services to you as per the agreement / work order executed between the parties.

2. That my client has raised invoices from time to time for the services rendered, which have been duly received and accepted by you without any objection.

3. That despite repeated reminders, requests and follow-ups, a sum of ${rs(c.amount)} remains outstanding and payable by you to my client, exclusive of interest.

4. That your failure to clear the dues amounts to breach of the agreement and has caused wrongful loss to my client.

I therefore call upon you to pay the said sum of ${rs(c.amount)} along with interest at 18% per annum from the due date till realisation, within ${c.deadline ?? 15} days from the receipt of this notice, failing which my client shall be constrained to initiate appropriate civil and/or criminal proceedings against you before the competent court, entirely at your risk as to costs and consequences.

A copy of this notice has been retained in my office for record and further action.`,
  },
  {
    key: "breach_of_contract",
    label: "Breach of contract / agreement",
    subject: () => `Legal notice for breach of agreement`,
    body: (c) =>
      `Under instructions from and on behalf of my client, ${c.company}, I hereby serve upon you the following legal notice:

1. That my client and you entered into an agreement for the provision of services on the terms and conditions mutually agreed between the parties.

2. That my client has always performed its obligations under the said agreement diligently and in good faith.

3. That you have committed breach of the terms of the said agreement, causing loss and damage to my client${c.amount ? ` assessed at ${rs(c.amount)}` : ""}.

4. That my client has given you sufficient opportunity to remedy the said breach, which you have failed to do.

I therefore call upon you to remedy the breach and compensate my client within ${c.deadline ?? 15} days from the receipt of this notice, failing which my client shall initiate appropriate legal proceedings against you, at your risk as to costs and consequences.`,
  },
  {
    key: "employee_misconduct",
    label: "Employee absence / misconduct",
    subject: (c) => `Notice for unauthorised absence / misconduct${c.employee ? ` – ${c.employee}` : ""}`,
    body: (c) =>
      `Under instructions from and on behalf of my client, ${c.company}, I hereby serve upon you the following notice:

1. That you were employed with my client and were deployed at the site assigned to you.

2. That you have remained absent from duty without any intimation or sanctioned leave and/or have committed acts of misconduct in violation of the standing orders and terms of your employment.

3. That company property, uniform and identity card issued to you have not been returned.

You are hereby called upon to report for duty and/or submit your written explanation, and return all company property, within ${c.deadline ?? 7} days of receipt of this notice, failing which it shall be presumed that you have voluntarily abandoned your employment, and my client shall take appropriate disciplinary and legal action against you, including recovery of dues as per law.`,
  },
  {
    key: "cheque_bounce",
    label: "Cheque dishonour (Sec. 138 NI Act)",
    subject: (c) => `Statutory notice under Section 138 of the Negotiable Instruments Act, 1881 for ${rs(c.amount)}`,
    body: (c) =>
      `Under instructions from and on behalf of my client, ${c.company}, I hereby serve upon you the following statutory notice under Section 138 read with Section 141 of the Negotiable Instruments Act, 1881:

1. That towards discharge of your legally enforceable debt / liability, you issued cheque no. ________ dated ________ drawn on ________ Bank for ${rs(c.amount)} in favour of my client.

2. That on presentation, the said cheque was returned unpaid with the remark "________" vide return memo dated ________.

3. That the dishonour of the said cheque constitutes an offence punishable under Section 138 of the Negotiable Instruments Act, 1881.

I therefore call upon you to make payment of the said cheque amount of ${rs(c.amount)} within 15 days of receipt of this notice, failing which my client shall be constrained to file a criminal complaint against you before the competent court under Section 138 of the said Act, at your risk as to costs and consequences.`,
  },
  {
    key: "general",
    label: "General legal notice",
    subject: () => `Legal notice`,
    body: (c) =>
      `Under instructions from and on behalf of my client, ${c.company}, I hereby serve upon you the following legal notice:

1. That ________.

2. That ________.

I therefore call upon you to ________ within ${c.deadline ?? 15} days from the receipt of this notice, failing which my client shall be constrained to take appropriate legal action against you, at your risk as to costs and consequences.`,
  },
];

export type NoticeForPdf = {
  notice_number: string;
  notice_date: string;
  mode: string;
  to_name: string;
  to_address: string;
  from_name: string;
  from_address: string;
  subject: string;
  body: string;
  signatory: string;
  signatoryLine: string;
};

const ascii = (s: string) => s.replace(/₹/g, "Rs. ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-");

export async function downloadNoticePdf(n: NoticeForPdf) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 20;
  const maxW = W - M * 2;
  let y = 20;
  const ensure = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 20;
    }
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(ascii(n.from_name || ""), W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const line of doc.splitTextToSize(ascii(n.from_address || ""), maxW)) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 4.2;
  }
  y += 1;
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 8;
  doc.setFontSize(10.5);
  doc.text(`Ref. No.: ${n.notice_number}`, M, y);
  const dt = new Date(n.notice_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Date: ${dt}`, W - M, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`BY ${ascii(n.mode).toUpperCase()}`, M, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text("To,", M, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(ascii(n.to_name || ""), M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  for (const line of doc.splitTextToSize(ascii(n.to_address || ""), maxW * 0.7)) {
    doc.text(line, M, y);
    y += 5;
  }
  y += 4;
  doc.setFont("helvetica", "bold");
  const subj = doc.splitTextToSize(`Subject: ${ascii(n.subject)}`, maxW);
  for (const line of subj) {
    ensure(6);
    doc.text(line, M, y);
    y += 5.5;
  }
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.text("Sir / Madam,", M, y);
  y += 7;
  for (const para of ascii(n.body).split(/\n\s*\n/)) {
    const lines = doc.splitTextToSize(para.trim(), maxW);
    for (const line of lines) {
      ensure(6);
      doc.text(line, M, y, { maxWidth: maxW });
      y += 5.2;
    }
    y += 3;
  }
  ensure(30);
  y += 6;
  doc.text("Yours faithfully,", M, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text(ascii(n.signatory), M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(ascii(n.signatoryLine), M, y);
  doc.save(`${n.notice_number}.pdf`);
}
