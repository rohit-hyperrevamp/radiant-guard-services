import { useEffect, useRef, useState } from "react";
import type { FormDefinition, FormField } from "@/lib/statutory-form-schema";
import type { DraftValues } from "@/lib/statutory-form-data";
import esic37 from "@/assets/compliance/esic37-page-1.jpg";
import accident11 from "@/assets/compliance/accident11-page-1.jpg";
import epf11 from "@/assets/compliance/epf11-page-1.jpg";
import pf2a from "@/assets/compliance/pf2-page-1.jpg";
import pf2b from "@/assets/compliance/pf2-page-2.jpg";

/** Page images of the unchanged originals plus their PDF point sizes (same coordinates as the export). */
const pages: Record<string, { src: string; w: number; h: number }[]> = {
  esic37: [{ src: esic37, w: 612, h: 792 }],
  accident11: [{ src: accident11, w: 1191, h: 842 }],
  epf11: [{ src: epf11, w: 595.2, h: 841.68 }],
  pf2: [{ src: pf2a, w: 612, h: 792 }, { src: pf2b, w: 612, h: 792 }],
};
const multiline = (f: FormField) => f.kind === "textarea" || f.height > 20 || !!f.lineHeight;

function Page({ page, index, fields, values, onChange, visible }: { page: { src: string; w: number; h: number }; index: number; fields: FormField[]; values: DraftValues; onChange: (k: string, v: string) => void; visible: (f: FormField) => boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / page.w));
    ro.observe(el); return () => ro.disconnect();
  }, [page.w]);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return <div ref={ref} className="relative w-full overflow-hidden border border-border bg-card shadow-sm" style={{ aspectRatio: `${page.w} / ${page.h}` }}>
    <img src={page.src} alt={`Original form page ${index + 1}`} className="absolute inset-0 h-full w-full select-none" draggable={false} />
    {fields.filter(f => f.page === index && visible(f)).map(f => {
      const value = values[f.key] ?? "";
      if (f.marks) return Object.entries(f.marks).map(([option, [cx, cy, rx, ry]]) => {
        const selected = value === option;
        const w = rx ? rx * 2 + 2 : 9, h = ry ? ry * 2 + 2 : 9;
        return <button key={`${f.key}-${option}`} type="button" title={`${f.label}: ${option}`} aria-label={`${f.label}: ${option}`} aria-pressed={selected}
          onClick={() => onChange(f.key, selected ? "" : option)}
          className={`absolute flex items-center justify-center border font-bold leading-none text-foreground transition-colors ${rx ? "rounded-full" : "rounded-sm"} ${selected ? "border-foreground bg-transparent" : "border-dashed border-primary/60 bg-primary/10 hover:bg-primary/25"}`}
          style={{ left: pct(cx - w / 2, page.w), top: pct(cy - h / 2, page.h), width: pct(w, page.w), height: pct(h, page.h), fontSize: 7 * scale, borderWidth: selected && rx ? Math.max(1, 0.8 * scale) : undefined }}>
          {selected && !rx ? "X" : ""}
        </button>;
      });
      const common = {
        id: `statutory-${f.key}`, title: f.label, "aria-label": f.label, value,
        className: "absolute resize-none border-0 bg-primary/10 p-0 font-sans text-foreground outline-none placeholder:text-primary/40 hover:bg-primary/15 focus:bg-primary/20 focus:ring-1 focus:ring-primary",
        style: { left: pct(f.x, page.w), top: pct(f.y, page.h), width: pct(f.width, page.w), height: pct(f.height, page.h), fontSize: Math.min(9, multiline(f) ? 9 : f.height - 2) * scale, lineHeight: f.lineHeight ? `${f.lineHeight * scale}px` : 1.15 },
      };
      return multiline(f)
        ? <textarea key={f.key} {...common} onChange={e => onChange(f.key, e.target.value)} />
        : <input key={f.key} {...common} onChange={e => onChange(f.key, e.target.value)} />;
    })}
  </div>;
}

/** On-screen replica of the original form: every blank is an editable box at the exact export position. */
export function StatutoryFormCanvas({ definition, values, onChange, visible }: { definition: FormDefinition; values: DraftValues; onChange: (k: string, v: string) => void; visible: (f: FormField) => boolean }) {
  return <div className="space-y-4">
    {pages[definition.id].map((page, i) => <Page key={i} page={page} index={i} fields={definition.fields} values={values} onChange={onChange} visible={visible} />)}
  </div>;
}
