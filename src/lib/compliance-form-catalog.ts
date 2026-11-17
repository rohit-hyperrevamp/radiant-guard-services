import catalog from "./compliance-form-catalog.json";
export const complianceFormCatalog = catalog;
export type ComplianceTemplate = (typeof catalog)[number];
export type ComplianceEntry = { id: string; page: number; x: number; y: number; text: string; size: number };
export function validateComplianceEntries(entries: ComplianceEntry[], sizes: { width: number; height: number }[]) {
  return entries.every(e => Number.isInteger(e.page) && e.page >= 0 && e.page < sizes.length && Number.isFinite(e.x) && Number.isFinite(e.y) && e.x >= 0 && e.y >= 0 && e.x < sizes[e.page].width && e.y < sizes[e.page].height && e.size >= 6 && e.size <= 24);
}
export async function exportCompliancePdf(source: Uint8Array, entries: ComplianceEntry[]) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.load(source);
  const pages = pdf.getPages();
  if (!validateComplianceEntries(entries, pages.map(p => p.getSize()))) throw new Error("An entry is outside its page.");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const e of entries) {
    if (!e.text.trim()) continue;
    const page = pages[e.page];
    const available = page.getWidth() - e.x - 12;
    const size = Math.min(e.size, available / Math.max(1, font.widthOfTextAtSize(e.text, 1)));
    try { page.drawText(e.text, { x: e.x, y: page.getHeight() - e.y - size, size, font }); }
    catch { throw new Error("This entry contains unsupported characters; download the original and complete it using its language font."); }
  }
  return new Blob([await pdf.save() as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}