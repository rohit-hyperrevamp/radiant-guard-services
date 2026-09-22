import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InvoiceNumberSeries = {
  id: string;
  state_code: string;
  state_name: string;
  number_prefix: string | null;
  fiscal_year: string;
  last_sequence: number;
  seq_padding: number;
  enabled: boolean;
  notes: string | null;
};

export type InvoiceNumberToken = {
  id: string;
  state_code: string;
  token: string;
  sample_party_name: string | null;
  customer_id: string | null;
  unit_id: string | null;
  enabled: boolean;
};

export type InvoiceNumberRow = {
  id: string;
  state_code: string;
  fiscal_year: string;
  month_code: string;
  sequence: number;
  client_token: string | null;
  invoice_no: string;
  party_name: string | null;
  irn_number: string | null;
  remarks: string | null;
  irn_date_text: string | null;
  source: string;
  issued_on: string | null;
};

export type InvoiceMonthCount = {
  state_code: string;
  fiscal_year: string;
  month_code: string;
  month_order: number;
  invoice_count: number;
  first_sequence: number;
  last_sequence: number;
};

export const MONTH_CODES = [
  "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR",
] as const;

/** Fiscal-year label for a date: April 2026 - March 2027 => "26-27". */
export function fiscalYearLabel(date: Date): string {
  const year = date.getFullYear();
  const start = date.getMonth() + 1 >= 4 ? year : year - 1;
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function monthCode(date: Date): string {
  return MONTH_CODES[(date.getMonth() + 9) % 12] ?? "APR";
}

export function buildInvoiceNumber(opts: {
  prefix?: string | null;
  monthCode: string;
  fiscalYear: string;
  token?: string | null;
  sequence: number;
  padding?: number;
}): string {
  const prefix = (opts.prefix ?? "").trim();
  const token = (opts.token ?? "").trim().toUpperCase();
  const seq = String(opts.sequence).padStart(Math.max(opts.padding ?? 4, 1), "0");
  return `${prefix ? `${prefix}-` : ""}${opts.monthCode}${opts.fiscalYear}-${token}${seq}`;
}

export function useInvoiceNumberSeries(fiscalYear?: string) {
  return useQuery({
    queryKey: ["invoice-number-series", fiscalYear ?? "all"],
    queryFn: async (): Promise<InvoiceNumberSeries[]> => {
      let query = supabase
        .from("invoice_number_series" as never)
        .select("id, state_code, state_name, number_prefix, fiscal_year, last_sequence, seq_padding, enabled, notes")
        .order("state_code");
      if (fiscalYear) query = query.eq("fiscal_year", fiscalYear);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceNumberSeries[];
    },
    staleTime: 60_000,
  });
}

export function useInvoiceNumberTokens() {
  return useQuery({
    queryKey: ["invoice-number-tokens"],
    queryFn: async (): Promise<InvoiceNumberToken[]> => {
      const { data, error } = await supabase
        .from("invoice_number_client_tokens" as never)
        .select("id, state_code, token, sample_party_name, customer_id, unit_id, enabled")
        .order("state_code")
        .order("token");
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceNumberToken[];
    },
    staleTime: 60_000,
  });
}

export function useInvoiceMonthCounts(fiscalYear: string) {
  return useQuery({
    queryKey: ["invoice-number-month-counts", fiscalYear],
    queryFn: async (): Promise<InvoiceMonthCount[]> => {
      const { data, error } = await supabase
        .from("invoice_number_month_counts" as never)
        .select("state_code, fiscal_year, month_code, month_order, invoice_count, first_sequence, last_sequence")
        .eq("fiscal_year", fiscalYear)
        .order("month_order");
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceMonthCount[];
    },
    staleTime: 60_000,
  });
}

/** Paged register read: server-side filtering keeps this light on 3k+ rows per state. */
export function useInvoiceRegistry(params: {
  fiscalYear: string;
  stateCode: string | null;
  monthCode: string | null;
  search: string;
  page: number;
  pageSize: number;
}) {
  const { fiscalYear, stateCode, monthCode: month, search, page, pageSize } = params;
  return useQuery({
    queryKey: ["invoice-number-registry", fiscalYear, stateCode, month, search, page, pageSize],
    queryFn: async (): Promise<{ rows: InvoiceNumberRow[]; total: number }> => {
      let query = supabase
        .from("invoice_number_registry" as never)
        .select(
          "id, state_code, fiscal_year, month_code, sequence, client_token, invoice_no, party_name, irn_number, remarks, irn_date_text, source, issued_on",
          { count: "exact" },
        )
        .eq("fiscal_year", fiscalYear);
      if (stateCode) query = query.eq("state_code", stateCode);
      if (month) query = query.eq("month_code", month);
      const needle = search.trim();
      if (needle) {
        const safe = needle.replace(/[%,]/g, " ").trim();
        query = query.or(`invoice_no.ilike.%${safe}%,party_name.ilike.%${safe}%,irn_number.ilike.%${safe}%`);
      }
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order("sequence", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as InvoiceNumberRow[], total: count ?? 0 };
    },
    staleTime: 30_000,
  });
}

/** Preview the next number for a state without consuming it. */
export async function peekInvoiceNumber(stateCode: string, on: Date, token?: string | null) {
  const { data, error } = await supabase.rpc("peek_invoice_number" as never, {
    _state_code: stateCode,
    _invoice_date: on.toISOString().slice(0, 10),
    _client_token: token ?? null,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { invoice_no: string; next_sequence: number; fiscal_year: string; month_code: string }
    | undefined;
  return row ?? null;
}

/** Consume the next number for a state and log it in the register. */
export async function allocateInvoiceNumber(args: {
  stateCode: string;
  on: Date;
  partyName?: string | null;
  token?: string | null;
  unitId?: string | null;
}) {
  const { data, error } = await supabase.rpc("allocate_invoice_number" as never, {
    _state_code: args.stateCode,
    _invoice_date: args.on.toISOString().slice(0, 10),
    _party_name: args.partyName ?? null,
    _client_token: args.token ?? null,
    _unit_id: args.unitId ?? null,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { invoice_no: string; sequence: number; fiscal_year: string; month_code: string }
    | undefined;
  if (!row) throw new Error("Invoice number could not be allocated");
  return row;
}
