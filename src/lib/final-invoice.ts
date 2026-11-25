import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";

// ---------------------------------------------------------------------------
// Final invoices — an invoice only gets a number when it is finalised. The
// number is drawn from the billing state's series (Control Center → Invoice
// Numbering) on the invoice date and can never be released again.
// ---------------------------------------------------------------------------

export type FinalInvoice = {
  id: string;
  invoice_no: string;
  state_code: string;
  fiscal_year: string;
  month_code: string;
  sequence: number;
  client_token: string | null;
  party_name: string | null;
  billing_state: string | null;
  invoice_date: string;
  period_start: string;
  period_end: string;
  total_value: number | null;
  part_key?: string | null;
  part_label?: string | null;
};

export const FINAL_INVOICE_QK = "final-invoices";

type UnitRow = {
  unit_id: string;
  period_start: string;
  period_end: string;
  part_key?: string | null;
  final_invoices: FinalInvoice | null;
};

/** Main part keeps the plain key; split parts add `|<part>`. */
export function unitPeriodKey(unitId: string, start: string, end: string, part?: string | null) {
  const base = `${unitId}|${start}|${end}`;
  return part && part !== "main" ? `${base}|${part}` : base;
}

/** Optional period filter on `final_invoice_units.period_end` (inclusive ISO dates). */
export type FinalInvoicePeriodFilter = { periodEndFrom?: string | null; periodEndTo?: string | null };

const FINAL_UNIT_COLS =
  "unit_id, period_start, period_end, part_key, final_invoices(id, part_key, part_label, invoice_no, state_code, fiscal_year, month_code, sequence, client_token, party_name, billing_state, invoice_date, period_start, period_end, total_value)";

/**
 * Final invoices for these units keyed by unitPeriodKey. With a period filter
 * only rows whose period_end falls in the range are read (a register only
 * looks up its viewed period). Id chunks are paged and run in parallel
 * through the shared bulk pool.
 */
export async function loadFinalInvoicesForUnits(
  unitIds: string[],
  period?: FinalInvoicePeriodFilter,
): Promise<Map<string, FinalInvoice>> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  const out = new Map<string, FinalInvoice>();
  if (!ids.length) return out;
  const rows = await fetchInChunks<UnitRow>(ids, (chunk, from, to) => {
    let q = supabase.from("final_invoice_units" as never).select(FINAL_UNIT_COLS).in("unit_id", chunk);
    if (period?.periodEndFrom) q = q.gte("period_end", period.periodEndFrom);
    if (period?.periodEndTo) q = q.lte("period_end", period.periodEndTo);
    return q.order("unit_id").order("period_start").order("part_key").range(from, to);
  }, { chunkSize: 200 });
  for (const row of rows) {
    if (!row.final_invoices) continue;
    out.set(unitPeriodKey(row.unit_id, row.period_start, row.period_end, row.part_key), row.final_invoices);
  }
  return out;
}

/** Final invoices issued for these units (all periods, or only `period` when given). */
export function useFinalInvoicesForUnits(unitIds: string[], period?: FinalInvoicePeriodFilter) {
  const ids = Array.from(new Set(unitIds)).sort();
  const from = period?.periodEndFrom ?? null;
  const to = period?.periodEndTo ?? null;
  return useQuery({
    // Prefix stays [FINAL_INVOICE_QK, ids] so existing invalidations still match.
    queryKey: [FINAL_INVOICE_QK, ids.join(","), from, to],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: () => loadFinalInvoicesForUnits(ids, { periodEndFrom: from, periodEndTo: to }),
  });
}

export type GenerateFinalInvoiceArgs = {
  unitIds: string[];
  periodStart: string;
  periodEnd: string;
  invoiceDate: string;
  billingState: string | null;
  clientToken?: string | null;
  customerId?: string | null;
  partyName?: string | null;
  taxableValue?: number;
  taxTotal?: number;
  totalValue?: number;
  partKey?: string | null;
  partLabel?: string | null;
};

export type GeneratedFinalInvoice = {
  invoice_no: string;
  sequence: number;
  fiscal_year: string;
  month_code: string;
  state_code: string;
  final_invoice_id: string;
};

export async function generateFinalInvoice(args: GenerateFinalInvoiceArgs): Promise<GeneratedFinalInvoice> {
  const { data, error } = await supabase.rpc("generate_final_invoice" as never, {
    _unit_ids: args.unitIds,
    _period_start: args.periodStart,
    _period_end: args.periodEnd,
    _invoice_date: args.invoiceDate,
    _billing_state: args.billingState,
    _client_token: args.clientToken ?? null,
    _customer_id: args.customerId ?? null,
    _party_name: args.partyName ?? null,
    _taxable_value: args.taxableValue ?? 0,
    _tax_total: args.taxTotal ?? 0,
    _total_value: args.totalValue ?? 0,
    _part_key: args.partKey ?? "main",
    _part_label: args.partLabel ?? null,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as GeneratedFinalInvoice | undefined;
  if (!row?.invoice_no) throw new Error("Invoice number could not be allocated");
  return row;
}
