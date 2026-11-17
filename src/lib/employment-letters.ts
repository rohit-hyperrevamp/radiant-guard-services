import layouts from "./employment-letter-layouts.json";

export type LetterKind = keyof typeof layouts;
export type LetterRun = { text: string; bold: boolean };
export type LetterLine = { top: number; left: number; width: number; size: number; family: string; runs: LetterRun[] };
export type LetterPage = { width: number; height: number; lines: LetterLine[] };
export type LetterCopy = { format: "radiant-employment-letter-v1"; kind: LetterKind; fields: Record<string, string>; pages: LetterPage[] };
export const LETTER_LABELS: Record<LetterKind, string> = {
  offer: "Offer Letter", appointment: "Appointment Letter", confirmation: "Confirmation Letter",
  termination: "Termination Letter", experience: "Experience Cum Relieving Letter", relieving: "Relieving Letter",
};
export const LETTER_GROUPS: Record<string, LetterKind[]> = {
  hiring: ["offer", "appointment"], confirmation: ["confirmation"], exit: ["termination", "experience", "relieving"],
};
export const LETTER_FIELDS: Record<string, string> = {
  salutation: "Salutation", name: "Employee name", employee_code: "Employee ID", address: "Address",
  designation: "Designation", annual_ctc: "Approved annual employee CTC (₹)", work_location: "Work location",
  issue_date: "Letter date", joining_date: "Joining date", confirmation_date: "Confirmation effective date",
  last_working_date: "Last working / termination effective date", resignation_date: "Resignation letter date",
  termination_reason: "Approved termination reason", performance_statement: "Approved performance statement",
  signatory: "Authorised signatory", signatory_title: "Signatory designation",
};

function date(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";

/** Only explicit employee/event values qualify; never derive employee CTC from client billing. */
export function employeeLetterFields(employee: Record<string, any>, resolved: Record<string, any> = {}): Record<string, string> {
  const exit = employee.offboarding_details ?? {};
  const terms = employee.other_info?.employment_terms ?? {};
  return {
    salutation: "", name: text(employee.full_name), employee_code: text(employee.employee_code || employee.candidate_code),
    address: [employee.present_address1, employee.present_address2, employee.present_city, employee.present_state, employee.present_pincode].filter(Boolean).join(", "),
    designation: text(resolved.designation_name), work_location: text(resolved.unit_city), annual_ctc: text(terms.annual_ctc),
    issue_date: date(new Date().toISOString()), joining_date: date(employee.preferred_joining_date),
    confirmation_date: date(terms.confirmation_date), last_working_date: date(exit.date_of_last_working),
    resignation_date: date(exit.date_of_resignation), termination_reason: text(exit.reason_text),
    performance_statement: text(exit.review), signatory: "", signatory_title: "",
  };
}

export function letterFieldKeys(kind: LetterKind): string[] {
  const source = JSON.stringify(layouts[kind]);
  return [...new Set(Array.from(source.matchAll(/\{\{([a-z_]+)\}\}/g), m => m[1]))];
}

export function createLetter(kind: LetterKind, fields: Record<string, string>): LetterCopy {
  const pages = structuredClone(layouts[kind]) as LetterPage[];
  for (const page of pages) for (const line of page.lines) for (const run of line.runs) {
    run.text = run.text.replace(/\{\{([a-z_]+)\}\}/g, (_m, key) => fields[key]?.trim() || "________________");
  }
  return { format: "radiant-employment-letter-v1", kind, fields: { ...fields }, pages };
}

export function decodeLetter(body: string): LetterCopy | null {
  if (!body.startsWith('{"format":"radiant-employment-letter-v1"')) return null;
  try {
    const value = JSON.parse(body);
    if (value.format !== "radiant-employment-letter-v1" || !(value.kind in LETTER_LABELS) || !Array.isArray(value.pages)) return null;
    return value as LetterCopy;
  } catch { return null; }
}

/** Shared sizing gives editable preview and vector PDF the same line widths. */
export function fitLetterLine(line: LetterLine, measure: (text: string, size: number, bold: boolean, family: string) => number, available: number): number {
  const width = line.runs.reduce((sum, run) => sum + measure(run.text, line.size, run.bold, line.family), 0);
  return width > available && width > 0 ? line.size * available / width : line.size;
}

export async function letterPdf(copy: LetterCopy): Promise<Blob> {
  const { default: JsPDF } = await import("jspdf");
  const first = copy.pages[0];
  if (!first) throw new Error("Letter has no pages");
  const pdf = new JsPDF({ unit: "pt", format: [first.width, first.height] });
  pdf.setProperties({ title: LETTER_LABELS[copy.kind] });
  copy.pages.forEach((page, index) => {
    if (index) pdf.addPage([page.width, page.height]);
    for (const line of page.lines) {
      const available = page.width - line.left - 65;
      const size = fitLetterLine(line, (value, fontSize, bold, family) => {
        pdf.setFont(family === "serif" ? "times" : "helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(fontSize); return pdf.getTextWidth(value);
      }, available);
      let x = line.left;
      for (const run of line.runs) {
        pdf.setFont(line.family === "serif" ? "times" : "helvetica", run.bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.text(run.text, x, line.top + line.size, { baseline: "alphabetic" });
        x += pdf.getTextWidth(run.text);
      }
    }
  });
  return pdf.output("blob");
}

export function downloadLetter(blob: Blob, filename: string): void {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    void navigator.share({ files: [file], title: filename }).catch((e) => { if (e.name !== "AbortError") downloadFallback(blob, filename); });
  } else downloadFallback(blob, filename);
}
function downloadFallback(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}