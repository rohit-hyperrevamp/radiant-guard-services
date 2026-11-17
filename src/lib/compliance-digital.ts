export type Box = [number, number, number, number];
export type DigitalText = { id: string; box: Box; origin: [number,number]; text: string; size: number; family: string; bold: boolean; italic: boolean; color: number };
export type DigitalField = { id: string; box: Box; label: string; size: number };
export type DigitalPage = { width: number; height: number; texts: DigitalText[]; paths: { d: string; width: number; stroke: number[] | null; fill: number[] | null }[]; fields: DigitalField[]; scanReview: boolean };
export type DigitalForm = { id: string; version: number; pages: DigitalPage[] };
export type DigitalDraft = { templateId: string; version: 1; values: Record<string, string> };
export const digitalKey = (page: number, id: string) => `${page}:${id}`;

export function parseDigitalDraft(text: string, form: DigitalForm): Record<string, string> {
  const draft: unknown = JSON.parse(text);
  if (!draft || typeof draft !== 'object' || !('templateId' in draft) || draft.templateId !== form.id || !('version' in draft) || draft.version !== 1 || !('values' in draft) || !draft.values || typeof draft.values !== 'object' || Array.isArray(draft.values)) throw new Error('Choose a draft exported from this form.');
  const allowed = new Set(form.pages.flatMap((p, i) => [...p.texts, ...p.fields].map(t => digitalKey(i, t.id))));
  const values: Record<string,string> = {};
  for (const [key,value] of Object.entries(draft.values)) {
    if (!allowed.has(key) || typeof value !== 'string' || value.length > 10000) throw new Error('The draft contains an invalid field.');
    values[key] = value;
  }
  return values;
}

/** Copies vector SVGs into an isolated print document; draft values never enter caches. */
export function digitalPrintHtml(svgs: string[], pages: Pick<DigitalPage,'width'|'height'>[], title: string) {
  if (svgs.length !== pages.length || !pages.length) throw new Error('No complete form to export.');
  const safeTitle=title.replace(/[<>&"']/g,'');
  const pageRules=pages.map((p,i)=>`@page form${i}{size:${p.width}pt ${p.height}pt;margin:0}`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>${pageRules}html,body{margin:0;padding:0}section{break-after:page;overflow:hidden}section:last-child{break-after:auto}svg{display:block;width:100%;height:100%}.digital-selection{display:none}</style></head><body>${svgs.map((svg,i)=>`<section style="page:form${i};width:${pages[i].width}pt;height:${pages[i].height}pt">${svg}</section>`).join('')}</body></html>`;
}