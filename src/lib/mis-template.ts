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

/**
 * "employee" prints one line per person (manpower-wise MIS). "site" prints one
 * line per client site, summing the people billed there (billing annexure).
 */
export type MisRowGrain = "employee" | "site";

export type MisTemplate = {
  id: string;
  customerId: string;
  name: string;
  enabled: boolean;
  rowGrain: MisRowGrain;
  /** false when the organization never receives an MIS sheet. */
  misApplicable: boolean;
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
  // Site-summary (annexure) style sheets
  { key: "cli_id", label: "CLI ID", aliases: ["client id", "cli", "unit code"] },
  { key: "vendor_name", label: "Vendor Name" },
  { key: "district", label: "District" },
  { key: "pin_code", label: "Pin Code", aliases: ["pincode"] },
  { key: "address", label: "Address" },
  { key: "gst_no", label: "GST No", aliases: ["gst number", "gstin"] },
  { key: "invoice_month", label: "Invoice Month", aliases: ["billing month", "period"] },
  { key: "sg_count", label: "SG Count", aliases: ["guard count", "headcount", "manpower"], numeric: true },
  { key: "regular_rate", label: "Regular SG Rate", numeric: true },
  { key: "increment_rate", label: "Increment SG Rate", numeric: true },
  { key: "regular_duties", label: "Regular SG Duties", numeric: true },
  { key: "increment_duties", label: "Increment SG Duties", numeric: true },
  { key: "regular_ot_hours", label: "Regular SG OTs (Hours)", numeric: true },
  { key: "increment_ot_hours", label: "Increment SG OTs (Hours)", numeric: true },
  { key: "service_charge_claimed", label: "Service Charge Claimed", numeric: true },
  { key: "gst_18", label: "GST@18%", numeric: true },
  { key: "invoice_value", label: "Invoice Value", numeric: true },
  { key: "total_duties", label: "Total Duties", numeric: true },
  { key: "total_ot_hours", label: "Total OT HRS", aliases: ["total ot hours"], numeric: true },
  { key: "remarks", label: "Remarks" },
  // Pan-India annexure sheets that bill a single guard rate per branch
  { key: "sg_rate", label: "SG Rate", numeric: true },
  { key: "worked_days", label: "Worked Days", aliases: ["worked day"], numeric: true },
  { key: "service_start_date", label: "Service Start Date" },
  { key: "service_end_date", label: "Service End Date" },
  { key: "basic_billing_claimed", label: "Basic Billing Claimed", numeric: true },
];

/** The original manpower-wise layout, used when an organization has no format. */
export const MIS_STANDARD_FIELD_KEYS = [
  "sr_no","invoice_no","invoice_date","emp_code","employee_name","regular_reliever","doj","entity",
  "designation","branch_name","state","branch_sap_code","zone","month_days","month_rate","billing_rate",
  "billing_rate_per_day","ot_rate","working_days","ot_duties","ot_amount","working_days_billing_with_ot",
  "total_regular_billing","ot_billing","total_billing","cgst","sgst","igst","grand_total",
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
export const MIS_NATIVE_CLIENT_KEYS = new Set([
  "zone",
  "branch_sap_code",
  "state",
  "branch_name",
  "cli_id",
  "district",
  "pin_code",
  "address",
  "gst_no",
]);

type TemplateRow = {
  id: string;
  customer_id: string;
  name: string;
  enabled: boolean;
  row_grain?: string | null;
  mis_applicable?: boolean | null;
};
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
    rowGrain: t.row_grain === "site" ? "site" : "employee",
    misApplicable: t.mis_applicable !== false,
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
    .select("id,customer_id,name,enabled,row_grain,mis_applicable")
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

/** Organizations marked "MIS not applicable": no MIS sheet is offered for them. */
export async function loadMisDisabledCustomerIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("mis_templates" as never)
    .select("customer_id,mis_applicable")
    .eq("mis_applicable", false);
  if (error) throw error;
  return new Set(
    ((data ?? []) as Array<{ customer_id: string }>).map((r) => String(r.customer_id)).filter(Boolean),
  );
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

export type ClientAttribute = { columnId: string; templateId: string; header: string };

/**
 * Optional attributes that the organization's MIS format contributes to every
 * one of its clients. Empty when the organization has no MIS format or no
 * column marked as a client attribute.
 */
export async function loadClientAttributesForCustomer(
  customerId: string | null | undefined,
): Promise<ClientAttribute[]> {
  if (!customerId) return [];
  const { data: templates, error } = await supabase
    .from("mis_templates" as never)
    .select("id")
    .eq("customer_id", customerId)
    .eq("enabled", true)
    .limit(1);
  if (error) throw error;
  const t = (templates ?? [])[0] as { id: string } | undefined;
  if (!t) return [];
  const { data, error: colErr } = await supabase
    .from("mis_template_columns" as never)
    .select("id,header,sort_order,enabled,client_attribute")
    .eq("template_id", t.id)
    .eq("client_attribute", true)
    .eq("enabled", true)
    .order("sort_order");
  if (colErr) throw colErr;
  return ((data ?? []) as Array<{ id: string; header: string }>).map((c) => ({
    columnId: c.id,
    templateId: t.id,
    header: c.header,
  }));
}

/** Attribute values held against one client: key is the column id. */
export async function loadClientAttributeValues(unitId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!unitId) return out;
  const { data, error } = await supabase
    .from("mis_unit_values" as never)
    .select("column_id,value")
    .eq("unit_id", unitId);
  if (error) throw error;
  for (const r of (data ?? []) as Array<{ column_id: string; value: string | null }>) {
    out[r.column_id] = r.value ?? "";
  }
  return out;
}

/** Save the attribute values entered on a client record. */
export async function saveClientAttributeValues(
  attributes: ClientAttribute[],
  unitId: string,
  values: Record<string, string>,
): Promise<void> {
  if (!unitId || attributes.length === 0) return;
  const rows = attributes.map((a) => ({
    template_id: a.templateId,
    column_id: a.columnId,
    unit_id: unitId,
    value: (values[a.columnId] ?? "").trim(),
  }));
  const { error } = await supabase
    .from("mis_unit_values" as never)
    .upsert(rows as never, { onConflict: "column_id,unit_id" });
  if (error) throw error;
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

/** Rates and period lengths describe a site, so they are never added up. */
const MIS_NON_ADDITIVE_KEYS = new Set([
  "month_days",
  "month_rate",
  "billing_rate",
  "billing_rate_per_day",
  "ot_rate",
  "regular_rate",
  "increment_rate",
  "sg_rate",
]);

/** Collapse the employee lines of each site into a single annexure row. */
function mergeRowsPerSite(sourceRows: MisSourceRow[]): MisSourceRow[] {
  const bySite = new Map<string, MisSourceRow>();
  for (const src of sourceRows) {
    const existing = bySite.get(src.unitId);
    if (!existing) {
      bySite.set(src.unitId, { unitId: src.unitId, values: { ...src.values } });
      continue;
    }
    for (const [key, value] of Object.entries(src.values)) {
      const field = MIS_SYSTEM_FIELD_BY_KEY.get(key);
      if (field?.numeric && !MIS_NON_ADDITIVE_KEYS.has(key)) {
        existing.values[key] = (Number(existing.values[key]) || 0) + (Number(value) || 0);
        continue;
      }
      const current = existing.values[key];
      if (current === "" || current == null || Number(current) === 0) existing.values[key] = value;
    }
  }
  let serial = 1;
  return Array.from(bySite.values()).map((row) => {
    const values = { ...row.values };
    if ("sr_no" in values) values.sr_no = serial++;
    for (const key of Object.keys(values)) {
      const field = MIS_SYSTEM_FIELD_BY_KEY.get(key);
      if (field?.numeric) values[key] = Math.round((Number(values[key]) || 0) * 100) / 100;
    }
    return { unitId: row.unitId, values };
  });
}

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
    : MIS_SYSTEM_FIELDS.filter((f) => MIS_STANDARD_FIELD_KEYS.includes(f.key)).map<MisColumn>((f, i) => ({
        id: `sys-${f.key}`,
        header: f.label,
        sortOrder: i,
        source: "system",
        systemKey: f.key,
        enabled: true,
        clientAttribute: false,
      }));

  const columns = cols.map((c) => ({ key: c.header, header: c.header }));
  const grain = template?.rowGrain ?? "employee";
  const lines = grain === "site" ? mergeRowsPerSite(sourceRows) : sourceRows;
  const rows = lines.map((src) => {
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
    cols.find(
      (c) => c.systemKey === (totalsLabelColumnKey ?? (grain === "site" ? "branch_name" : "employee_name")),
    ) ?? cols[0];
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
