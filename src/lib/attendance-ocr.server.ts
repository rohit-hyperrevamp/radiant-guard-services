import { generateText } from "ai";

import type {
  AttendanceOcrInput,
  AttendanceOcrResult,
  AttendanceOcrRow,
  AttendanceOcrRowSummary,
} from "./sheet-ocr-types";
import { aiKeyConfigured, runVision } from "./ai-provider.server";

const SYSTEM_PROMPT = `You are a FAST, careful OCR engine reading a hand-written or printed monthly attendance / muster-roll sheet from India.
You will be given the exact list of employees (id, name, employee_code, designation) and the exact list of period dates.

ABSOLUTE RULES:
1. VISIBLE DAYS ONLY — First, look at the day-number column headers printed on the sheet (e.g. "1 2 3 ... 30"). Note the LARGEST visible day number N. Do NOT emit any row whose entry_date day-of-month is greater than N, even if the period list contains later dates. If the sheet shows 30 days, never emit day 31.
2. NEVER EXTRAPOLATE — Only emit a row for a cell you can actually SEE filled in on the paper. Empty/blank cells = no row. Do not pattern-fill or assume continuation.
3. PRACTICAL CONFIDENCE — Extract as much real data as you can from visible cells. Set "confident": true when the code is the most likely reading and not meaningfully ambiguous. If the mark is visible but slightly messy, still extract it. Use "confident": false only when the symbol is genuinely unclear, contradictory, or too faint.
4. Match each visible row to one employee in the list by name OR employee_code. Use candidate_id (UUID) in output, NEVER the name. Minor spelling differences, line breaks, or handwriting variation are OK if one employee is clearly the same person. If you truly cannot match a row, add the visible name to unmatched_names and DO NOT guess a candidate_id.
5. "code" MUST correspond to one of the provided code strings. Prefer the closest exact code from the allowed list rather than leaving the cell blank, but only if the written mark clearly points to that code. If still unsure, set code to "" and confident to false.
6. "ot_hours" is the OVERTIME-DAYS number for that day cell (OT sub-row under each day belongs to the same date). 0.5 means HALF an OT day, 1 means ONE OT day, 1.5 means one-and-a-half OT days. It is NOT hours. Typical max is 2. 0 if blank. If the digit is unclear, set confident=false for that cell.
   SPECIAL CASE — handwritten muster shorthand: a cell value of "D" or "ED" (optionally followed by a comma and a number, e.g. "D ,1" or "ED ,1") means the person was PRESENT that day AND worked the trailing number as OT days. Emit code="P" with ot_hours=<the number> (default 1 if no number is written). Never emit code="D" or code="ED" — always normalize to "P".
7. Cross-check each matched employee row against the handwritten/printed totals on the RIGHT side of the same row (P Days, OT, T Days). Use those totals as a validation hint, but DO NOT discard a clearly visible day cell only because the totals are slightly hard to read or do not fully reconcile.
8. Return ONLY a single compact JSON object with exactly these top-level keys: r, s, u, n. No markdown fences, no prose.
9. Each s item is [candidate_id, designation_id_or_empty, p_days, ot_days, t_days, confident].
   - Output numeric DAY values, not text. Examples: "8:4" means 8.5 days, "44:8" means 45 days.
   - Set row_summaries[].confident=true ONLY when the right-side totals are clearly legible for that employee row.
   - If a total is unreadable, use null for that field.
10. Group visible attendance cells by person. Each r item is [candidate_id, designation_id_or_empty, [[entry_date,code,ot_hours,confident],...]]. Do not repeat candidate_id or designation_id for every day.
11. u is the unmatched visible names array. n states the largest visible day number, e.g. "visible_days=30".`;

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

  const employeeList = data.employees
    .map(
      (e) =>
        `- candidate_id=${e.id} | designation_id=${e.designation_id ?? ""} | ${e.name}${e.employee_code ? ` | code=${e.employee_code}` : ""}${e.designation ? ` | designation=${e.designation}` : ""}`,
    )
    .join("\n");
  const codeList = data.codes.map((c) => `${c.code} = ${c.label}`).join(", ");
  const dateList = data.dates.join(", ");

  const promptText = `Codes: ${codeList}\nDates: ${dateList}\nEmployees (allowed candidate/designation pairs):\n${employeeList}\n\nMatch each printed row by code/name/designation. Copy IDs exactly. If its designation is not an allowed pair, put the visible name in u. Return compact JSON only:\n{"r":[["candidate-uuid","designation-uuid-or-empty",[["YYYY-MM-DD","P",0,true]]]],"s":[["candidate-uuid","designation-uuid-or-empty",26.5,18.5,45,true]],"u":[],"n":"visible_days=NN"}`;


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

  const compactGroups = Array.isArray(output.r) ? output.r : [];
  const compactRows: Array<Record<string, unknown>> = [];
  for (const group of compactGroups) {
    if (!Array.isArray(group)) continue;
    const [candidateId, designationId, cells] = group;
    if (!Array.isArray(cells)) continue;
    for (const cell of cells) {
      if (!Array.isArray(cell)) continue;
      compactRows.push({
        candidate_id: candidateId,
        designation_id: designationId,
        entry_date: cell[0],
        code: cell[1],
        ot_hours: cell[2],
        confident: cell[3],
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
        .filter((item): item is unknown[] => Array.isArray(item))
        .map((item) => ({
          candidate_id: item[0],
          designation_id: item[1],
          p_days: item[2],
          ot_days: item[3],
          t_days: item[4],
          confident: item[5],
        }))
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
