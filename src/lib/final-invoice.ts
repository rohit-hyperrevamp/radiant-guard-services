import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
};

export const FINAL_INVOICE_QK = "final-invoices";

type UnitRow = {
  unit_id: string;
  period_start: string;
  period_end: string;
  final_invoices: FinalInvoice | null;
};

export function unitPeriodKey(unitId: string, start: string, end: string) {
  return `${unitId}|${start}|${end}`;
}

/** Every final invoice already issued for these units (all periods). */
export function useFinalInvoicesForUnits(unitIds: string[]) {
  const ids = Array.from(new Set(unitIds)).sort();
  return useQuery({
    queryKey: [FINAL_INVOICE_QK, ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, FinalInvoice>> => {
      const out = new Map<string, FinalInvoice>();
      const chunk = 200;
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk);
        const { data, error } = await supabase
          .from("final_invoice_units" as never)
          .select(
            "unit_id, period_start, period_end, final_invoices(id, invoice_no, state_code, fiscal_year, month_code, sequence, client_token, party_name, billing_state, invoice_date, period_start, period_end, total_value)",
          )
          .in("unit_id", slice);
        if (error) throw error;
        for (const row of (data ?? []) as unknown as UnitRow[]) {
          if (!row.final_invoices) continue;
          out.set(unitPeriodKey(row.unit_id, row.period_start, row.period_end), row.final_invoices);
        }
      }
      return out;
    },
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
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as GeneratedFinalInvoice | undefined;
  if (!row?.invoice_no) throw new Error("Invoice number could not be allocated");
  return row;
}
