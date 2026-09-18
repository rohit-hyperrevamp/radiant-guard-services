import { generateText } from "ai";

import type {
  AttendanceOcrInput,
  AttendanceOcrResult,
  AttendanceOcrRow,
  AttendanceOcrRowSummary,
} from "./sheet-ocr-types";
import { aiKeyConfigured, runVision } from "./ai-provider.server";

const SYSTEM_PROMPT = `You are a meticulous OCR engine reading a hand-written or printed monthly attendance / muster-roll sheet from India. This data drives payroll and client invoicing: a single wrong cell causes a financial error, so accuracy matters far more than speed.
You will be given a NUMBERED list of employees (each with a number, name, employee_code, designation) and the exact list of period dates.

ABSOLUTE RULES:
1. DAY COLUMN HEADERS FIRST — Read the day-number headers printed across the top of the grid (they often run e.g. 21,22,...,30 then 1,2,...,20 for a 21st-to-20th period). Map every cell you read to the correct date from the provided Dates list by matching that column's day number. Never shift a row left or right: count columns carefully, including blank ones.
2. VISIBLE DAYS ONLY — Do not emit a cell for a day column that is not printed on the sheet.
3. NEVER EXTRAPOLATE — Only emit a cell you can actually SEE filled in. Blank cell = no entry. Never pattern-fill or assume continuation. A row that ends early (struck through with a line) stops there.
4. Identify each printed row by matching its name AND employee_code to the numbered employee list, and output that employee's NUMBER in "e". Never output names or UUIDs. Minor spelling/handwriting differences are fine when the person is clearly the same. If a printed row matches no employee, put its visible name in "u" and emit no cells for it.
5. "code" MUST be one of the provided code strings. If a mark is visible but you cannot decide which code it is, output code "" with confident=false so a human corrects it — never guess.
6. "ot" is the OVERTIME-DAYS number written in the sub-row under that same day cell. 0.5 = half an OT day, 1 = one OT day. It is NOT hours: a written "8" in an OT sub-row means one 8-hour duty, i.e. 1 OT day. 0 when blank. Typical max is 2.
   SPECIAL CASE — shorthand "D" or "ED" (optionally with a trailing number, e.g. "D ,1") means PRESENT that day plus that many OT days. Emit code "P" with ot = the number (default 1). Never emit code "D" or "ED".
7. SELF-CHECK BEFORE ANSWERING — For every row, count your own emitted present-type cells and compare with the handwritten totals on the RIGHT of that row (P Days, OT, T Days). If your count does not match P Days, re-read that row's columns and correct it before answering. Report those printed totals in "s" exactly as written.
8. Confidence — set confident=true when the mark is legible and unambiguous, false when messy, faint or contradictory. Do not mark a cell confident just to finish.
9. Return ONLY a single JSON object, no markdown fences, no prose, with exactly these keys:
{"r":[{"e":1,"c":[["YYYY-MM-DD","P",0,true]]}],"s":[{"e":1,"p":26,"o":8,"t":27,"k":true}],"u":[],"n":"visible_days=NN"}
   - r = per-employee cells; c items are [entry_date, code, ot, confident].
   - s = printed right-side totals per employee: p=P Days, o=OT total, t=T Days, k=true only when those totals are clearly legible. Use null for an unreadable total.
   - u = visible names that matched no employee. n = largest visible day number.`;

function stripMarkdownFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripMarkdownFences(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to balanced-brace extraction.
  }

  for (let start = 0; start < cleaned.length; start++) {
    if (cleaned[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = cleaned.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              return parsed as Record<string, unknown>;
            }
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("OCR returned unreadable JSON");
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[^\d.\-]/g, "");
    return cleaned ? Number(cleaned) : 0;
  }
  return Number(value ?? 0);
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "y";
  }
  return Boolean(value);
}

function toDayNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, value) : null;
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    const mixed = raw.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (mixed) {
      const days = Number(mixed[1]);
      const hours = Number(mixed[2]);
      if (Number.isFinite(days) && Number.isFinite(hours)) {
        return Math.max(0, days + hours / 8);
      }
    }
    const cleaned = raw.replace(/[^\d.\-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? Math.max(0, num) : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, num) : null;
}

export async function runAttendanceOcr(data: AttendanceOcrInput): Promise<AttendanceOcrResult> {
  // Company Google Gemini key only — billed to the company's Google account.
  if (!aiKeyConfigured()) {
    throw new Error(
      "Sheet reading is not available: the Google Gemini key is not configured.",
    );
  }

  // One numbered entry per distinct person. The model outputs the NUMBER, never
  // an identifier, so no row can be lost to a mis-copied UUID.
  const numberedEmployees: Array<{ id: string; designation_id: string | null }> = [];
  const numberByCandidate = new Map<string, number>();
  const employeeLines: string[] = [];
  for (const e of data.employees) {
    if (numberByCandidate.has(e.id)) continue;
    numberedEmployees.push({ id: e.id, designation_id: e.designation_id ?? null });
    const number = numberedEmployees.length;
    numberByCandidate.set(e.id, number);
    employeeLines.push(
      `${number}. ${e.name}${e.employee_code ? ` | code=${e.employee_code}` : ""}${e.designation ? ` | designation=${e.designation}` : ""}`,
    );
  }
  const employeeList = employeeLines.join("\n");
  const codeList = data.codes.map((c) => `${c.code} = ${c.label}`).join(", ");
  const dateList = data.dates.join(", ");

  const promptText = `Codes: ${codeList}\nDates (in day-column order as printed): ${dateList}\nEmployees (use the leading number in "e"):\n${employeeList}\n\nRead every visible cell for the rows printed on this sheet, map columns to dates by their printed day number, self-check each row against its printed P Days / OT / T Days totals, then return the JSON object described in your instructions. JSON only.`;


  const { text } = await runVision((model) =>
    generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text" as const, text: promptText },
            {
              type: "image" as const,
              image: (() => {
                const m = data.imageDataUrl.match(/^data:[^;]+;base64,(.+)$/);
                if (!m) return new URL(data.imageDataUrl);
                const b64 = m[1]!;
                return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              })(),
            },
          ],
        },
      ],
      temperature: 0,
    }),
  );

  const output = extractJsonObject(text);

  const validIds = new Set(data.employees.map((e) => e.id));
  const validPairs = new Set(data.employees.map((e) => `${e.id}|${e.designation_id ?? ""}`));
  const primaryDesigByCand = new Map<string, string | null>();
  for (const e of data.employees) {
    if (!primaryDesigByCand.has(e.id)) {
      primaryDesigByCand.set(e.id, e.designation_id ?? null);
    }
  }
  const validDates = new Set(data.dates);
  const validCodeMap = new Map(data.codes.map((c) => [c.code.trim().toUpperCase(), c.code]));

  const notesStr = String(output.n ?? output.notes ?? "");
  const visibleMatch = notesStr.match(/visible_days\s*=\s*(\d{1,2})/i);
  const visibleDays = visibleMatch ? Math.min(31, Math.max(1, parseInt(visibleMatch[1]!, 10))) : null;

  /** Resolve an employee number (1-based) back to its candidate + designation. */
  const resolveNumber = (value: unknown) => {
    const num = Math.round(toNumber(value));
    if (!Number.isFinite(num) || num < 1 || num > numberedEmployees.length) return null;
    return numberedEmployees[num - 1] ?? null;
  };

  const compactGroups = Array.isArray(output.r) ? output.r : [];
  const compactRows: Array<Record<string, unknown>> = [];
  for (const group of compactGroups) {
    const numberValue = Array.isArray(group)
      ? group[0]
      : (group as { e?: unknown } | null)?.e;
    const cells = Array.isArray(group) ? group[1] : (group as { c?: unknown } | null)?.c;
    const resolved = resolveNumber(numberValue);
    if (!resolved || !Array.isArray(cells)) continue;
    for (const cell of cells) {
      const isArr = Array.isArray(cell);
      const c = cell as { entry_date?: unknown; code?: unknown; ot?: unknown; confident?: unknown };
      compactRows.push({
        candidate_id: resolved.id,
        designation_id: resolved.designation_id ?? "",
        entry_date: isArr ? (cell as unknown[])[0] : c?.entry_date,
        code: isArr ? (cell as unknown[])[1] : c?.code,
        ot_hours: isArr ? (cell as unknown[])[2] : c?.ot,
        confident: isArr ? (cell as unknown[])[3] : c?.confident,
      });
    }
  }
  const rows = compactRows.length > 0 ? compactRows : Array.isArray(output.rows) ? output.rows : [];
  const cleanedRows: AttendanceOcrRow[] = [];
  for (const r of rows) {
    const candidate_id = String((r as { candidate_id?: unknown }).candidate_id ?? "");
    const desigRaw = String((r as { designation_id?: unknown }).designation_id ?? "").trim();
    const entry_date = String((r as { entry_date?: unknown }).entry_date ?? "");
    const codeRaw = String((r as { code?: unknown }).code ?? "").trim();
    const ot = toNumber((r as { ot_hours?: unknown }).ot_hours ?? 0);
    const confidentRaw = toBoolean((r as { confident?: unknown }).confident);

    if (!validIds.has(candidate_id) || !validDates.has(entry_date)) continue;
    let designation_id: string | null = null;
    if (desigRaw && validPairs.has(`${candidate_id}|${desigRaw}`)) {
      designation_id = desigRaw;
    } else if (validPairs.has(`${candidate_id}|`)) {
      designation_id = null;
    } else {
      designation_id = primaryDesigByCand.get(candidate_id) ?? null;
    }
    if (visibleDays !== null) {
      const dayNum = parseInt(entry_date.slice(8, 10), 10);
      if (Number.isFinite(dayNum) && dayNum > visibleDays) continue;
    }
    const code = codeRaw === "" ? "" : (validCodeMap.get(codeRaw.toUpperCase()) ?? "");
    const codeValid = codeRaw === "" || code !== "";
    const ot_hours = Number.isFinite(ot) ? Math.max(0, Math.min(2, ot)) : 0;
    if (!code && ot_hours <= 0) continue;
    cleanedRows.push({
      candidate_id,
      designation_id,
      entry_date,
      code,
      ot_hours,
      confident: confidentRaw && codeValid && code !== "",
    });
  }

  const compactSummaries = Array.isArray(output.s)
    ? output.s
        .map((item) => {
          const isArr = Array.isArray(item);
          const o = item as { e?: unknown; p?: unknown; o?: unknown; t?: unknown; k?: unknown } | null;
          const resolved = resolveNumber(isArr ? (item as unknown[])[0] : o?.e);
          if (!resolved) return null;
          return {
            candidate_id: resolved.id,
            designation_id: resolved.designation_id ?? "",
            p_days: isArr ? (item as unknown[])[1] : o?.p,
            ot_days: isArr ? (item as unknown[])[2] : o?.o,
            t_days: isArr ? (item as unknown[])[3] : o?.t,
            confident: isArr ? (item as unknown[])[4] : o?.k,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];
  const summaryItems = compactSummaries.length > 0
    ? compactSummaries
    : Array.isArray(output.row_summaries) ? output.row_summaries : [];
  const summaries = summaryItems.length > 0
    ? summaryItems
        .map((item) => {
          const summary = item as {
            candidate_id?: unknown;
            designation_id?: unknown;
            p_days?: unknown;
            ot_days?: unknown;
            t_days?: unknown;
            confident?: unknown;
          };
          const candidate_id = String(summary.candidate_id ?? "");
          if (!validIds.has(candidate_id)) return null;
          const desigRaw = String(summary.designation_id ?? "").trim();
          let designation_id: string | null = null;
          if (desigRaw && validPairs.has(`${candidate_id}|${desigRaw}`)) {
            designation_id = desigRaw;
          } else if (validPairs.has(`${candidate_id}|`)) {
            designation_id = null;
          } else {
            designation_id = primaryDesigByCand.get(candidate_id) ?? null;
          }
          return {
            candidate_id,
            designation_id,
            p_days: toDayNumber(summary.p_days),
            ot_days: toDayNumber(summary.ot_days),
            t_days: toDayNumber(summary.t_days),
            confident: toBoolean(summary.confident),
          } satisfies AttendanceOcrRowSummary;
        })
        .filter((item): item is AttendanceOcrRowSummary => item !== null)
    : [];

  const unmatchedRaw = Array.isArray(output.u) ? output.u : output.unmatched_names;
  const unmatched = Array.isArray(unmatchedRaw)
    ? unmatchedRaw.map((n) => String(n)).slice(0, 50)
    : [];

  return {
    rows: cleanedRows,
    row_summaries: summaries,
    unmatched_names: unmatched,
    notes: notesStr,
  };
}
