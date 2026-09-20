/**
 * Configurable MIS per organization.
 *
 * The MIS sheet used to be one fixed layout built around a single client. Now
 * each organization (customer) can hold its own column list in Control Center →
 * MIS: some columns the system fills itself (employee, rates, GST…), the rest are
 * custom values stored per client site. Exports read the organization's template
 * and fall back to the standard layout when there is none.
 */

import { supabase } from "@/integrations/supabase/client";

export type MisColumnSource = "system" | "custom";

export type MisColumn = {
  id: string;
  header: string;
  sortOrder: number;
  source: MisColumnSource;
  systemKey: string | null;
  enabled: boolean;
  /** Also shown as an optional field on every client of the organization. */
  clientAttribute: boolean;
};

export type MisTemplate = {
  id: string;
  customerId: string;
  name: string;
  enabled: boolean;
  columns: MisColumn[];
};

export type MisSystemField = {
  key: string;
  label: string;
  /** Extra header spellings recognised when a client's sheet is uploaded. */
  aliases?: string[];
  /** Totals row sums numeric columns. */
  numeric?: boolean;
};

/** Everything the system can fill by itself, in the standard sheet order. */
export const MIS_SYSTEM_FIELDS: MisSystemField[] = [
  { key: "sr_no", label: "Sr. No", aliases: ["sr no", "serial no", "s no"] },
  { key: "invoice_no", label: "Invoice No", aliases: ["invoice number"] },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "emp_code", label: "Emp Code", aliases: ["employee code", "employee id"] },
  { key: "employee_name", label: "Employee Name", aliases: ["name of employee", "name"] },
  { key: "regular_reliever", label: "Regular/ Reliever Guard", aliases: ["regular reliever", "regular/reliever"] },
  { key: "doj", label: "DOJ", aliases: ["date of joining"] },
  { key: "entity", label: "Entity", aliases: ["vendor", "agency"] },
  { key: "designation", label: "Designation", aliases: ["category", "skill"] },
  { key: "branch_name", label: "Location/Branch Name", aliases: ["branch name", "location", "site"] },
  { key: "state", label: "State" },
  { key: "branch_sap_code", label: "Branch SAP Code", aliases: ["sap code", "branch sap"] },
  { key: "zone", label: "Zone" },
  { key: "month_days", label: "Month Days", aliases: ["days in month"], numeric: true },
  { key: "month_rate", label: "Month Rate", aliases: ["payroll days"], numeric: true },
  { key: "billing_rate", label: "Billing Rate", numeric: true },
  { key: "billing_rate_per_day", label: "Billing Rate (Per Day)", aliases: ["per day rate"], numeric: true },
  { key: "ot_rate", label: "OT Rate", aliases: ["overtime rate"], numeric: true },
  { key: "working_days", label: "Working days", aliases: ["present days", "duties"], numeric: true },
  { key: "ot_duties", label: "OT and Night duties", aliases: ["ot duties", "extra duty"], numeric: true },
  { key: "ot_amount", label: "OT Amount", numeric: true },
  { key: "working_days_billing_with_ot", label: "Working days Billing with OT", numeric: true },
  { key: "total_regular_billing", label: "Total Regular Billing Amt", numeric: true },
  { key: "ot_billing", label: "OT & Night Duty Billing Amt", numeric: true },
  { key: "total_billing", label: "Total Billing Amt", aliases: ["taxable value"], numeric: true },
  { key: "cgst", label: "CGST @9%", aliases: ["cgst"], numeric: true },
  { key: "sgst", label: "SGST @9%", aliases: ["sgst"], numeric: true },
  { key: "igst", label: "IGST @18%", aliases: ["igst"], numeric: true },
  { key: "grand_total", label: "Grand Total", aliases: ["total with gst"], numeric: true },
];

export const MIS_SYSTEM_FIELD_BY_KEY = new Map(MIS_SYSTEM_FIELDS.map((f) => [f.key, f]));

const norm = (v: string | null | undefined) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ALIAS_INDEX = (() => {
  const m = new Map<string, string>();
  for (const f of MIS_SYSTEM_FIELDS) {
    m.set(norm(f.label), f.key);
    for (const a of f.aliases ?? []) m.set(norm(a), f.key);
  }
  return m;
})();

/** Match an uploaded sheet heading to a system field, or null when it is custom. */
export function matchMisSystemKey(header: string): string | null {
  return ALIAS_INDEX.get(norm(header)) ?? null;
}

/**
 * System columns that already exist as their own field on the client record,
 * so they never need a separate custom attribute.
 */
export const MIS_NATIVE_CLIENT_KEYS = new Set(["zone", "branch_sap_code", "state", "branch_name"]);

type TemplateRow = { id: string; customer_id: string; name: string; enabled: boolean };
type ColumnRow = {
  id: string;
  template_id: string;
  header: string;
  sort_order: number;
  source: string;
  system_key: string | null;
  enabled: boolean;
  client_attribute?: boolean | null;
};

function toTemplate(t: TemplateRow, cols: ColumnRow[]): MisTemplate {
  return {
    id: t.id,
    customerId: t.customer_id,
    name: t.name,
    enabled: t.enabled !== false,
    columns: cols
      .filter((c) => c.template_id === t.id && c.enabled !== false)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.id,
        header: c.header,
        sortOrder: c.sort_order,
        source: c.source === "system" ? "system" : "custom",
        systemKey: c.system_key,
        enabled: c.enabled !== false,
        clientAttribute: c.client_attribute === true,
      })),
  };
}

/** Load the active MIS template for an organization, or null. */
export async function loadMisTemplateForCustomer(customerId: string | null | undefined): Promise<MisTemplate | null> {
  if (!customerId) return null;
  const { data: templates, error } = await supabase
    .from("mis_templates" as never)
    .select("id,customer_id,name,enabled")
    .eq("customer_id", customerId)
    .eq("enabled", true)
    .limit(1);
  if (error) throw error;
  const t = (templates ?? [])[0] as TemplateRow | undefined;
  if (!t) return null;
  const { data: cols, error: colErr } = await supabase
    .from("mis_template_columns" as never)
    .select("id,template_id,header,sort_order,source,system_key,enabled,client_attribute")
    .eq("template_id", t.id)
    .order("sort_order");
  if (colErr) throw colErr;
  return toTemplate(t, (cols ?? []) as ColumnRow[]);
}

/** Custom values saved for the given sites: key is `${columnId}|${unitId}`. */
export async function loadMisUnitValues(templateId: string, unitIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!templateId || unitIds.length === 0) return map;
  for (let i = 0; i < unitIds.length; i += 150) {
    const chunk = unitIds.slice(i, i + 150);
    const { data, error } = await supabase
      .from("mis_unit_values" as never)
      .select("column_id,unit_id,value")
      .eq("template_id", templateId)
      .in("unit_id", chunk);
    if (error) throw error;
    for (const r of (data ?? []) as Array<{ column_id: string; unit_id: string; value: string | null }>) {
      map.set(`${r.column_id}|${r.unit_id}`, r.value ?? "");
    }
  }
  return map;
}

/** One exported employee line: system values by key, for one client site. */
export type MisSourceRow = {
  unitId: string;
  values: Record<string, unknown>;
};

export type MisSheet = {
  columns: Array<{ key: string; header: string }>;
  rows: Array<Record<string, unknown>>;
};

/**
 * Build the sheet for an organization's template. Without a template, the
 * standard system layout is used so existing exports are unchanged.
 */
export function buildMisSheet({
  template,
  sourceRows,
  unitValues,
  totalsLabelColumnKey,
}: {
  template: MisTemplate | null;
  sourceRows: MisSourceRow[];
  unitValues?: Map<string, string>;
  /** Column that carries the "TOTAL" caption; defaults to Employee Name. */
  totalsLabelColumnKey?: string;
}): MisSheet {
  const cols = template?.columns.length
    ? template.columns
    : MIS_SYSTEM_FIELDS.map<MisColumn>((f, i) => ({
        id: `sys-${f.key}`,
        header: f.label,
        sortOrder: i,
        source: "system",
        systemKey: f.key,
        enabled: true,
        clientAttribute: false,
      }));

  const columns = cols.map((c) => ({ key: c.header, header: c.header }));
  const rows = sourceRows.map((src) => {
    const row: Record<string, unknown> = {};
    for (const c of cols) {
      if (c.source === "system" && c.systemKey) {
        row[c.header] = src.values[c.systemKey] ?? "";
      } else {
        row[c.header] = unitValues?.get(`${c.id}|${src.unitId}`) ?? "";
      }
    }
    return row;
  });

  if (rows.length === 0) return { columns, rows: [{}] };

  const totalsRow: Record<string, unknown> = {};
  for (const c of cols) totalsRow[c.header] = "";
  const labelCol =
    cols.find((c) => c.systemKey === (totalsLabelColumnKey ?? "employee_name")) ?? cols[0];
  if (labelCol) totalsRow[labelCol.header] = "TOTAL";
  for (const c of cols) {
    if (c.source !== "system" || !c.systemKey) continue;
    if (!MIS_SYSTEM_FIELD_BY_KEY.get(c.systemKey)?.numeric) continue;
    if (c.systemKey === "month_days" || c.systemKey === "month_rate") continue;
    const sum = rows.reduce((s, r) => s + (Number(r[c.header]) || 0), 0);
    totalsRow[c.header] = Math.round(sum * 100) / 100;
  }
  return { columns, rows: [...rows, totalsRow] };
}
