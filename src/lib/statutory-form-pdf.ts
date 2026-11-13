import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { templateBytes } from "@/assets/compliance/templates";
import { statutoryForms, type FormId } from "./statutory-form-schema";
import type { DraftValues } from "./statutory-form-data";

/** Overlay only verified values; the supplied template pages are never reconstructed. */
export async function buildStatutoryPdf(id: FormId, values: DraftValues, draft = true): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes[id]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const definition = statutoryForms.find(f => f.id === id);
  if (!definition) throw new Error("Unknown statutory form");
  for (const field of definition.fields) {
    const page = pdf.getPage(field.page);
    let value = values[field.key]?.trim() ?? "";
    if (!value) continue;
    // Choice marks land in the original printed options, not new text boxes.
    let x = field.x, y = field.y;
    if (field.kind === "parent") { x = value === "Spouse" ? 216 : 113; value = "X"; }
    if (field.kind === "kyc") { y = ({"Not uploaded": 692, "Uploaded, not approved": 702, "Approved with DSC": 712} as Record<string, number>)[value] ?? y; value = "X"; }
    if (field.kind === "transfer") { y = value === "Digital transfer approved" ? 756 : 778; value = "X"; }
    if (field.kind === "choice") { x = value === "Yes" ? 406 : 429; value = "X"; }
    // Helvetica cannot represent every script. Never silently omit/replace PII.
    try { font.encodeText(value.replace(/\r?\n/g, " ")); } catch { throw new Error(`${field.label}: use English transliteration for this original form.`); }
    let size = Math.min(9, field.height - 2);
    let lines: string[] = [];
    for (; size >= 4; size -= 0.25) {
      lines = [];
      for (const paragraph of value.split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(next, size) > field.width && line) { lines.push(line); line = word; }
          else line = next;
        }
        lines.push(line);
      }
      if (lines.length * (size + 1) <= field.height && lines.every(l => font.widthOfTextAtSize(l, size) <= field.width)) break;
    }
    if (size < 4) throw new Error(`${field.label} is too long for the original form. Shorten it before export.`);
    lines.forEach((line, i) => page.drawText(line, {x, y: page.getHeight() - y - size - i * (size + 1), size, font, color: rgb(0, 0, 0)}));
  }
  if (draft) for (const page of pdf.getPages()) page.drawText("DRAFT - Missing details / declarations / signatures must be verified before submission", {x: 24, y: 10, size: 7, font, color: rgb(0.35, 0.35, 0.35)});
  pdf.setTitle(definition.title);
  return pdf.save();
}
export async function combineStatutoryPdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const doc = await PDFDocument.load(bytes);
    for (const page of await out.copyPages(doc, doc.getPageIndices())) out.addPage(page);
  }
  return out.save();
}