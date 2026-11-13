import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { DraftValues } from "@/lib/statutory-form-data";

/** Digital replicas of the supplied statutory forms. All geometry is in PDF points so screen and print match the originals. */
type Ctx = { values: DraftValues; set: (k: string, v: string) => void; hidden: (k: string) => boolean };
const FormCtx = createContext<Ctx>({ values: {}, set: () => {}, hidden: () => false });
export const FormProvider = FormCtx.Provider;
export const useForm = () => useContext(FormCtx);

export const FONT = {
  arial: "Arimo, Arial, Helvetica, sans-serif",
  hindi: "'Noto Sans Devanagari', Mangal, sans-serif",
  calibri: "Carlito, Calibri, Arimo, sans-serif",
  times: "Tinos, 'Times New Roman', Times, serif",
  cambria: "Caladea, Cambria, Tinos, serif",
};
export const FORM_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,700;1,400&family=Caladea:ital,wght@0,400;0,700;1,400;1,700&family=Carlito:ital,wght@0,400;0,700;1,700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Tinos:wght@400;700&display=swap";

export function Sheet({ w, h, font, children, border }: { w: number; h: number; font: string; children: ReactNode; border?: [number, number, number, number] }) {
  return <div className="stat-sheet" data-size={`${w}pt ${h}pt`} style={{ width: `${w}pt`, height: `${h}pt`, fontFamily: font }}>
    {border && <div style={{ position: "absolute", left: `${border[0]}pt`, top: `${border[1]}pt`, width: `${border[2] - border[0]}pt`, height: `${border[3] - border[1]}pt`, border: "0.75pt solid #000" }} />}
    {children}
  </div>;
}

type TProps = { x: number; y: number; w?: number; s: number; children?: ReactNode; align?: "left" | "center" | "right" | "justify"; b?: boolean; i?: boolean; font?: string; style?: CSSProperties; lh?: number };
/** Absolutely positioned text line/block. y = top of the printed text in points. */
export function T({ x, y, w, s, children, align = "left", b, i, font, style, lh }: TProps) {
  return <div style={{ position: "absolute", left: `${x}pt`, top: `${y}pt`, width: w ? `${w}pt` : undefined, fontSize: `${s}pt`, lineHeight: lh ?? 1.12, fontWeight: b ? 700 : 400, fontStyle: i ? "italic" : undefined, fontFamily: font, textAlign: align, whiteSpace: lh ? "normal" : "pre", display: w && !lh && align !== "justify" ? "flex" : "block", alignItems: "baseline", justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : undefined, textAlignLast: align === "justify" ? "justify" : undefined, ...style }}>{children}</div>;
}

/** Shrinks the text until it fits its fixed box, like a filled form would. */
function useFit(ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, value: string, base: number, multi: boolean) {
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      let s = base; el.style.fontSize = `${s}pt`;
      const over = () => multi ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
      while (over() && s > base * 0.45) { s -= 0.25; el.style.fontSize = `${s}pt`; }
    };
    fit();
    // Re-measure once the form's own fonts finish loading.
    let live = true;
    void document.fonts?.ready.then(() => { if (live) fit(); });
    return () => { live = false; };
  }, [ref, value, base, multi]);
}

/** Inline fill-in blank printed as dots or an underline; grows to fill the rest of the line unless w is set. */
export function Blank({ k, w, line = "dotted", s, align = "left", font, label, upper }: { k: string; w?: number; line?: "dotted" | "solid" | "none"; s?: number; align?: "left" | "center"; font?: string; label?: string; upper?: boolean }) {
  const { values, set, hidden } = useForm();
  const ref = useRef<HTMLInputElement>(null);
  const v = hidden(k) ? "" : values[k] ?? "";
  useFit(ref, v, s ?? 9, false);
  return <input ref={ref} className="stat-field" aria-label={label ?? k} title={label ?? k} value={v} disabled={hidden(k)}
    onChange={e => set(k, upper ? e.target.value.toUpperCase() : e.target.value)}
    style={{ flex: w ? `0 0 ${w}pt` : "1 1 0", width: w ? `${w}pt` : "auto", minWidth: 0, fontFamily: font ?? FONT.arial, textAlign: align, borderBottom: line === "none" ? 0 : `${line === "dotted" ? "1pt dotted" : "0.6pt solid"} #000`, height: "1.25em", lineHeight: 1.1 }} />;
}

/** Field occupying a fixed rectangle (table cells, boxes). */
export function Box({ k, x, y, w, h, s = 9, multi, font, align = "left", label, lh }: { k: string; x: number; y: number; w: number; h: number; s?: number; multi?: boolean; font?: string; align?: "left" | "center"; label?: string; lh?: number }) {
  const { values, set, hidden } = useForm();
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const v = hidden(k) ? "" : values[k] ?? "";
  useFit(ref, v, s, !!multi);
  const style: CSSProperties = { position: "absolute", left: `${x}pt`, top: `${y}pt`, width: `${w}pt`, height: `${h}pt`, fontFamily: font ?? FONT.arial, textAlign: align, lineHeight: lh ? `${lh}pt` : 1.15 };
  return multi
    ? <textarea ref={ref} className="stat-field" aria-label={label ?? k} title={label ?? k} value={v} disabled={hidden(k)} onChange={e => set(k, e.target.value)} style={style} />
    : <input ref={ref} className="stat-field" aria-label={label ?? k} title={label ?? k} value={v} disabled={hidden(k)} onChange={e => set(k, e.target.value)} style={style} />;
}

/** Printed square tick box; clicking selects `option` for field k. */
export function Tick({ k, option, x, y, size = 8, square = true }: { k: string; option: string; x: number; y: number; size?: number; square?: boolean }) {
  const { values, set } = useForm();
  const on = values[k] === option;
  return <button type="button" className="stat-tick" aria-pressed={on} aria-label={option} title={option} onClick={() => set(k, on ? "" : option)}
    style={{ position: "absolute", left: `${x}pt`, top: `${y}pt`, width: `${size}pt`, height: `${size}pt`, border: square ? "0.75pt solid #000" : 0, fontSize: `${size}pt`, lineHeight: 1 }}>{on ? "✓" : ""}</button>;
}

/** Printed "Yes / No": the chosen word is circled. */
export function YesNo({ k, x, y, s }: { k: string; x: number; y: number; s: number }) {
  const { values, set } = useForm();
  const opt = (o: string) => <button type="button" className="stat-choice" aria-pressed={values[k] === o} aria-label={o} onClick={() => set(k, values[k] === o ? "" : o)}
    style={{ border: values[k] === o ? "0.9pt solid #000" : "0.9pt solid transparent", borderRadius: "50%", padding: "0 1.5pt", font: "inherit" }}>{o}</button>;
  return <T x={x} y={y} s={s} b>{opt("Yes")} / {opt("No")}</T>;
}

/** Ruled lines and table cells. */
export const HLine = ({ x1, x2, y, t = 0.6, dash }: { x1: number; x2: number; y: number; t?: number; dash?: boolean }) =>
  <div style={{ position: "absolute", left: `${x1}pt`, top: `${y - t / 2}pt`, width: `${x2 - x1}pt`, borderTop: `${t}pt ${dash ? "dashed" : "solid"} #000` }} />;
export const VLine = ({ y1, y2, x, t = 0.6, dash }: { y1: number; y2: number; x: number; t?: number; dash?: boolean }) =>
  <div style={{ position: "absolute", top: `${y1}pt`, left: `${x - t / 2}pt`, height: `${y2 - y1}pt`, borderLeft: `${t}pt ${dash ? "dashed" : "solid"} #000` }} />;
export const Rect = ({ x, y, w, h, t = 0.75 }: { x: number; y: number; w: number; h: number; t?: number }) =>
  <div style={{ position: "absolute", left: `${x}pt`, top: `${y}pt`, width: `${w}pt`, height: `${h}pt`, border: `${t}pt solid #000` }} />;
