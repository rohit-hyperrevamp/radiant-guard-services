import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Contract-level invoice output rules. A contract can bill everything on one
// invoice (default) or route each kind of billable item to a separate invoice
// part — or leave it out. Each part takes its own number when finalised.
// ---------------------------------------------------------------------------

export type InvoiceItemKey = "regular" | "ph" | "ed" | "reliever" | "extras";
export type InvoicePart = { key: string; label: string };
export type InvoiceSplit = {
  parts: InvoicePart[];
  /** Item → part key, or "exclude" to leave it off every invoice. */
  assign: Record<InvoiceItemKey, string>;
};

export const EXCLUDE = "exclude";
export const MAIN_PART = "main";

export const INVOICE_ITEMS: { key: InvoiceItemKey; label: string; hint: string }[] = [
  { key: "regular", label: "Regular duties", hint: "Present days of the posted guard" },
  { key: "ph", label: "Paid holidays", hint: "PH days credited from the attendance sheet" },
  { key: "ed", label: "Extra Duty (ED)", hint: "Extra duties / overtime entered on the sheet" },
  { key: "reliever", label: "Reliever duties", hint: "Duties done as reliever at this site (incl. night cover)" },
  { key: "extras", label: "Additional charges", hint: "Extra charges added to the invoice" },
];

export const DEFAULT_SPLIT: InvoiceSplit = {
  parts: [{ key: MAIN_PART, label: "Main invoice" }],
  assign: { regular: MAIN_PART, ph: MAIN_PART, ed: MAIN_PART, reliever: MAIN_PART, extras: MAIN_PART },
};

export function parseInvoiceSplit(raw: unknown): InvoiceSplit {
  if (!raw || typeof raw !== "object") return DEFAULT_SPLIT;
  const r = raw as { parts?: unknown; assign?: unknown };
  const parts = (Array.isArray(r.parts) ? r.parts : [])
    .map((p) => ({ key: String((p as InvoicePart)?.key ?? "").trim(), label: String((p as InvoicePart)?.label ?? "").trim() }))
    .filter((p) => p.key);
  if (!parts.length) return DEFAULT_SPLIT;
  const keys = new Set(parts.map((p) => p.key));
  const a = (r.assign ?? {}) as Record<string, unknown>;
  const assign = {} as Record<InvoiceItemKey, string>;
  for (const it of INVOICE_ITEMS) {
    const v = String(a[it.key] ?? parts[0].key);
    assign[it.key] = v === EXCLUDE || keys.has(v) ? v : parts[0].key;
  }
  return { parts: parts.map((p, i) => ({ ...p, label: p.label || `Invoice ${i + 1}` })), assign };
}

export const isSplit = (s: InvoiceSplit) =>
  s.parts.length > 1 || Object.values(s.assign).some((v) => v === EXCLUDE);

export async function loadContractInvoiceSplit(contractId: string | null): Promise<InvoiceSplit> {
  if (!contractId) return DEFAULT_SPLIT;
  const { data } = await supabase
    .from("client_contracts")
    .select("invoice_split" as never)
    .eq("id", contractId)
    .maybeSingle();
  return parseInvoiceSplit((data as { invoice_split?: unknown } | null)?.invoice_split);
}

type TotalsLike = { pDays: number; phDays: number; otDays: number; otHours: number; tDays: number };

/**
 * Billed days of one invoice line that belong to `part`. Reliever lines go
 * wholly to the reliever part; primary lines split regular / PH / ED.
 */
export function totalsForPart<T extends TotalsLike>(totals: T, isPrimary: boolean, split: InvoiceSplit, part: string): T {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (!isPrimary) {
    const on = split.assign.reliever === part;
    return on ? totals : { ...totals, pDays: 0, phDays: 0, otDays: 0, otHours: 0, tDays: 0 };
  }
  const pDays = split.assign.regular === part ? totals.pDays : 0;
  const phDays = split.assign.ph === part ? totals.phDays : 0;
  const otDays = split.assign.ed === part ? totals.otDays : 0;
  return { ...totals, pDays, phDays, otDays, otHours: otDays, tDays: r2(pDays + phDays + otDays) };
}
