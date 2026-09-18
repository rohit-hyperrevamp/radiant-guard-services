import { generateText } from "ai";

import type {
  MigrationSheetDay,
  MigrationSheetEmployee,
  MigrationSheetInput,
  MigrationSheetResult,
} from "./sheet-ocr-types";
import { runVision } from "./ai-provider.server";

/**
 * Migration Utility sheet reader.
 *
 * Unlike the muster-roll reader (which matches an image against employees that
 * already exist), this reads a legacy attendance sheet for a unit whose
 * employees are NOT in the system yet. It returns the employees printed on the
 * sheet plus their day-wise attendance so the utility can create them.
 */

const SYSTEM_PROMPT = `You read printed or hand-written monthly attendance / muster-roll sheets from an Indian security-services company.
You are given the exact period dates, the allowed attendance codes and the allowed designations for the unit.

RULES:
1. Emit one entry per EMPLOYEE ROW visible on the sheet. Read the printed name, employee code (if any) and mobile number (if any).
2. VISIBLE DAYS ONLY — only emit a day cell you can actually see filled in. Never extrapolate or pattern-fill.
3. "code" must be one of the allowed codes. Normalise handwritten shorthand: "D" or "ED" (optionally ", 1") means PRESENT plus that many EXTRA DUTY days — emit code "P" with ot_hours set to the trailing number (default 1).
4. "ot_hours" is the number of EXTRA DUTY DAYS for that date (0, 0.5, 1, 1.5, 2). It is not clock hours. 0 when blank.
5. "designation_id" must be copied verbatim from one of the allowed designations, matched on the designation written on the sheet. If only one designation is allowed, use it. If you cannot tell, use "".
6. Return ONLY one JSON object, no markdown fences, no prose.`;

function stripFences(text: string) {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = stripFences(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  }
  throw new Error("The sheet could not be read. Please try a clearer image.");
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export async function runMigrationSheetExtraction(
  data: MigrationSheetInput,
): Promise<MigrationSheetResult> {

  const prompt = [
    `Allowed attendance codes: ${data.codes.map((c) => `${c.code} = ${c.label}`).join(", ")}`,
    `Allowed designations (use the id verbatim):\n${data.designations.map((d) => `- id=${d.id} | ${d.name}`).join("\n") || "- (none)"}`,
    `Period dates: ${data.dates.join(", ")}`,
    `Return JSON exactly in this shape:`,
    `{"employees":[{"name":"","employee_code":"","mobile":"","designation_id":"","days":[{"entry_date":"YYYY-MM-DD","code":"P","ot_hours":0}]}],"notes":"visible_days=NN"}`,
  ].join("\n\n");

  const images = data.imageDataUrls?.length
    ? data.imageDataUrls
    : data.imageDataUrl
      ? [data.imageDataUrl]
      : [];
  const toImage = (url: string) => {
    const m = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!m) return new URL(url);
    return Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0));
  };
  const content = images.length
    ? [
        {
          type: "text" as const,
          text:
            images.length > 1
              ? `${prompt}\n\nThere are ${images.length} page images of the SAME sheet. Read them all and merge into one employee list; if a row continues across pages, merge its day cells.`
              : prompt,
        },
        ...images.map((url) => ({ type: "image" as const, image: toImage(url) })),
      ]
    : [
        { type: "text" as const, text: prompt },
        {
          type: "text" as const,
          text: `Spreadsheet contents (tab-separated rows, exactly as in the uploaded file):\n\n${data.sheetText}`,
        },
      ];

  const { text } = await runVision((model) =>
    generateText({
      model,
      system: SYSTEM_PROMPT,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  );

  const out = parseJson(text);
  const validDates = new Set(data.dates);
  const codeMap = new Map(data.codes.map((c) => [c.code.trim().toUpperCase(), c.code]));
  const desigById = new Map(data.designations.map((d) => [d.id, d.name]));
  const onlyDesig = data.designations.length === 1 ? data.designations[0]! : null;

  const rawEmployees = Array.isArray(out.employees) ? out.employees : [];
  const employees: MigrationSheetEmployee[] = [];
  for (const raw of rawEmployees) {
    const r = raw as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const desigRaw = String(r.designation_id ?? "").trim();
    const designation_id = desigById.has(desigRaw) ? desigRaw : onlyDesig?.id ?? null;
    const days: MigrationSheetDay[] = [];
    const rawDays = Array.isArray(r.days) ? r.days : [];
    for (const d of rawDays) {
      const dd = d as Record<string, unknown>;
      const entry_date = String(dd.entry_date ?? "").trim();
      if (!validDates.has(entry_date)) continue;
      const code = codeMap.get(String(dd.code ?? "").trim().toUpperCase()) ?? "";
      if (!code) continue;
      days.push({ entry_date, code, ot_hours: num(dd.ot_hours) });
    }
    employees.push({
      name,
      employee_code: String(r.employee_code ?? "").trim(),
      mobile: String(r.mobile ?? "").replace(/\D/g, "").slice(-10),
      designation_id,
      designation_name: designation_id ? desigById.get(designation_id) ?? "" : "",
      days,
    });
  }

  return { employees, notes: String(out.notes ?? "") };
}
