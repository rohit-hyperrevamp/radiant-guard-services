import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

/**
 * Migration Utility OCR.
 *
 * Unlike the muster-roll OCR (which matches an image against employees that
 * already exist), this reads a legacy attendance sheet for a unit whose
 * employees are NOT in the system yet. It returns the employees printed on the
 * sheet plus their day-wise attendance so the utility can create them.
 */

const InputSchema = z
  .object({
    imageDataUrl: z.string().min(20).max(20_000_000).optional(),
    sheetText: z.string().min(5).max(400_000).optional(),
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(40),
    codes: z.array(z.object({ code: z.string(), label: z.string() })).min(1).max(40),
    designations: z.array(z.object({ id: z.string(), name: z.string() })).max(50),
  })
  .refine((v) => Boolean(v.imageDataUrl || v.sheetText), {
    message: "Provide either a sheet image or spreadsheet text",
  });

export type MigrationSheetDay = { entry_date: string; code: string; ot_hours: number };

export type MigrationSheetEmployee = {
  name: string;
  employee_code: string;
  mobile: string;
  designation_id: string | null;
  designation_name: string;
  days: MigrationSheetDay[];
};

export type MigrationSheetResult = {
  employees: MigrationSheetEmployee[];
  notes: string;
};

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

export const extractMigrationSheet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<MigrationSheetResult> => {
    const gatewayKey = process.env["LOVABLE_API_KEY"];
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!gatewayKey && !geminiKey) {
      throw new Error("AI service is not configured. Please contact support.");
    }

    let model;
    if (gatewayKey) {
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      model = createLovableAiGatewayProvider(gatewayKey)("google/gemini-2.5-flash");
    } else {
      const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
      model = createOpenAICompatible({
        name: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: geminiKey,
      })("gemini-2.5-flash");
    }


    const prompt = [
      `Allowed attendance codes: ${data.codes.map((c) => `${c.code} = ${c.label}`).join(", ")}`,
      `Allowed designations (use the id verbatim):\n${data.designations.map((d) => `- id=${d.id} | ${d.name}`).join("\n") || "- (none)"}`,
      `Period dates: ${data.dates.join(", ")}`,
      `Return JSON exactly in this shape:`,
      `{"employees":[{"name":"","employee_code":"","mobile":"","designation_id":"","days":[{"entry_date":"YYYY-MM-DD","code":"P","ot_hours":0}]}],"notes":"visible_days=NN"}`,
    ].join("\n\n");

    const imageDataUrl = data.imageDataUrl;
    const content = imageDataUrl
      ? [
          { type: "text" as const, text: prompt },
          {
            type: "image" as const,
            image: (() => {
              const m = imageDataUrl.match(/^data:[^;]+;base64,(.+)$/);
              if (!m) return new URL(imageDataUrl);
              return Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0));
            })(),
          },
        ]
      : [
          { type: "text" as const, text: prompt },
          {
            type: "text" as const,
            text: `Spreadsheet contents (tab-separated rows, exactly as in the uploaded file):\n\n${data.sheetText}`,
          },
        ];

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      temperature: 0,
      messages: [{ role: "user", content }],
    });

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
  });
