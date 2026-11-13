import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, readFileSync } from "fs";
import { FormProvider, FORM_FONTS_HREF } from "./src/components/statutory/form-kit";
import { Esic37Form } from "./src/components/statutory/Esic37Form";
const forms: Record<string, any> = { esic37: Esic37Form };
for (const extra of ["Epf11Form", "AccidentBookForm", "Pf2Form"]) { try { const m = require(`./src/components/statutory/${extra}`); forms[extra] = m[extra]; } catch {} }
const css = readFileSync("./src/styles.css", "utf8").split("/* Digital statutory forms")[1];
const filled = process.argv[2] === "filled";
const values: Record<string, string> = filled ? new Proxy({}, { get: (_, k) => typeof k === "string" ? (k.startsWith("nom") || k.startsWith("family") ? "Sample 12" : k.length < 4 ? "12/10/2026" : "Sample Text 12345") : undefined }) as any : {};
for (const [id, F] of Object.entries(forms)) {
  const html = renderToStaticMarkup(<FormProvider value={{ values, set: () => {}, hidden: () => false }}><div className="stat-print">{<F />}</div></FormProvider>);
  writeFileSync(`/tmp/qa/${id}.html`, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FORM_FONTS_HREF}"><style>*{box-sizing:border-box}body{margin:0} /* ${css}</style></head><body>${html}</body></html>`);
}
