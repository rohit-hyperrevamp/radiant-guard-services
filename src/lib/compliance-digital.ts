export type Box = [number, number, number, number];
export type DigitalText = { id: string; box: Box; origin: [number,number]; text: string; size: number; family: string; bold: boolean; italic: boolean; color: number; direction?: [number,number]; sourceMarkup?: string; outlined?: boolean };
export type DigitalField = { id: string; box: Box; label: string; size: number; placeholder?: boolean; factKey?: string };
export type DigitalPage = { width: number; height: number; texts: DigitalText[]; paths: { d: string; width: number; stroke: number[] | null; fill: number[] | null }[]; fields: DigitalField[]; scanReview: boolean; sourceArtwork?: string };
export type DigitalForm = { id: string; version: number; pages: DigitalPage[]; draftAliases?: Record<string,string> };
export type DigitalDraft = { templateId: string; version: 1; values: Record<string, string> };
export const digitalKey = (page: number, id: string) => `${page}:${id}`;

/** Fixed paper geometry: wrap edited values instead of squeezing one long line. */
export function digitalFieldLines(value: string, box: Box, preferredSize: number, measure?: (text: string, size: number) => number) {
  const width = Math.max(1, box[2] - box[0]);
  const height = Math.max(1, box[3] - box[1]);
  for (let size = Math.min(preferredSize, height / 1.15); size >= 4; size -= .5) {
    const fits = (text: string) => (measure ? measure(text,size) : text.length * size * .6) <= width;
    const lines: string[] = [];
    for (const paragraph of value.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        if (line && !fits(`${line} ${word}`)) { lines.push(line); line = ''; }
        let remainder = word;
        while (remainder && !fits(remainder)) {
          if (line) { lines.push(line); line = ''; }
          let cut = remainder.length - 1;
          while (cut > 0 && !fits(remainder.slice(0,cut))) cut--;
          if (!cut) break;
          lines.push(remainder.slice(0,cut)); remainder = remainder.slice(cut);
        }
        line = line ? `${line} ${remainder}` : remainder;
      }
      lines.push(line);
    }
    if (lines.every(fits) && lines.length * size * 1.15 <= height) return { size, lines, overflow: false };
  }
  return { size: 4, lines: value.split('\n'), overflow: true };
}

/** Position answers within the existing blank, never move or stretch its paper geometry. */
export function digitalAnswerLayout(value: string, box: Box, size: number, measure?: (text:string,size:number)=>number) {
  const fitted = digitalFieldLines(value,box,size,measure);
  const blockHeight = fitted.lines.length * fitted.size * 1.15;
  const top = box[1] + Math.max(0,Math.min(2,(box[3]-box[1]-blockHeight)/2));
  return {...fitted, x:box[0], baseline:top + fitted.size};
}

export function parseDigitalDraft(text: string, form: DigitalForm): Record<string, string> {
  const draft: unknown = JSON.parse(text);
  if (!draft || typeof draft !== 'object' || !('templateId' in draft) || draft.templateId !== form.id || !('version' in draft) || draft.version !== 1 || !('values' in draft) || !draft.values || typeof draft.values !== 'object' || Array.isArray(draft.values)) throw new Error('Choose a draft exported from this form.');
  const allowed = new Set(form.pages.flatMap((p, i) => [...p.texts, ...p.fields].map(t => digitalKey(i, t.id))));
  const values: Record<string,string> = {};
  for (const [key,value] of Object.entries(draft.values)) {
    const target=form.draftAliases?.[key]??key;
    if (!allowed.has(target) || typeof value !== 'string' || value.length > 10000) throw new Error('The draft contains an invalid field.');
    if(values[target]&&value&&values[target]!==value)throw new Error('This older draft has different answers in cells now combined. Review it before importing.');
    if(value||values[target]===undefined)values[target] = value;
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