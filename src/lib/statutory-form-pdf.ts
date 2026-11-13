import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { templateBytes } from "@/assets/compliance/templates";
import { statutoryForms, type FormField, type FormId } from "./statutory-form-schema";
import type { DraftValues } from "./statutory-form-data";

/** Single-line boxes are vertically centred; taller boxes wrap from the top. Shared with the on-screen form. */
export const isMultiline = (f: FormField) => f.kind === "textarea" || f.height > 20 || !!f.lineHeight;

/** Overlay only verified values; the supplied template pages are never reconstructed. */
export async function buildStatutoryPdf(id: FormId, values: DraftValues, draft = true): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes[id]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const definition = statutoryForms.find(f => f.id === id);
  if (!definition) throw new Error("Unknown statutory form");
  for (const field of definition.fields) {
    const page = pdf.getPage(field.page);
    const H = page.getHeight();
    const value = values[field.key]?.trim() ?? "";
    if (!value) continue;
    // Choice marks land on the original printed options, never as new text.
    if (field.marks) {
      const m = field.marks[value];
      if (!m) continue;
      const [cx, cy, rx, ry] = m;
      if (rx) page.drawEllipse({ x: cx, y: H - cy, xScale: rx, yScale: ry, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
      else { const s = 7; page.drawText("X", { x: cx - bold.widthOfTextAtSize("X", s) / 2, y: H - cy - s * 0.36, size: s, font: bold, color: rgb(0, 0, 0) }); }
      continue;
    }
    // Helvetica cannot represent every script. Never silently omit/replace PII.
    try { font.encodeText(value.replace(/\r?\n/g, " ")); } catch { throw new Error(`${field.label}: use English transliteration for this original form.`); }
    const multi = isMultiline(field);
    let size = Math.min(9, multi ? 9 : field.height - 2);
    let lines: string[] = [];
    const gap = (s: number) => field.lineHeight ?? s + 1.5;
    for (; size >= 4; size -= 0.25) {
      lines = [];
      for (const paragraph of multi ? value.split("\n") : [value.replace(/\s*\n\s*/g, ", ")]) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (multi && font.widthOfTextAtSize(next, size) > field.width && line) { lines.push(line); line = word; }
          else line = next;
        }
        lines.push(line);
      }
      const fitsH = multi ? size + (lines.length - 1) * gap(size) <= field.height : true;
      if (fitsH && lines.every(l => font.widthOfTextAtSize(l, size) <= field.width)) break;
    }
    if (size < 4) throw new Error(`${field.label} is too long for the original form. Shorten it before export.`);
    const first = multi ? field.y + size : field.y + field.height / 2 + size * 0.35;
    lines.forEach((line, i) => page.drawText(line, { x: field.x, y: H - first - i * gap(size), size, font, color: rgb(0, 0, 0) }));
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
