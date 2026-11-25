import { checkedQueryData } from "@/lib/finance-source";
/**
 * Bulk loader for the invoice engine: the same per-site data the invoice page
 * loads, fetched for many sites (each over its own period) in a few batched
 * reads. Every rule that selects rows mirrors loadInvoiceUnitData exactly.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks, mapPool, runBulk } from "@/lib/supabase-batch";
import { getReference } from "@/lib/reference-data";
import type { RateRevisionRow } from "@/lib/rate-revisions";
import { visibleAttendanceCandidateIds } from "@/lib/attendance-roster-eligibility";
import { resolveOrgInvoiceSplit, type InvoiceSplit } from "@/lib/invoice-split";
import type { AttendanceEntryFetchRow } from "@/lib/attendance-fetch";
import {
  additionLowerBound,
  contextAdditions,
  contextCopy,
  contextCovers,
  contextDeductions,
  INVOICE_ADDITION_FIELDS,
  INVOICE_DEDUCTION_FIELDS,
  type FinanceSharedContext,
} from "@/lib/finance-shared-context";
import {
  billingModeFromCode,
  unitPhFromRow,
  type InvoiceCandidate,
  type InvoiceExtraLike,
  type InvoiceUnitData,
  type RawAddition,
  type RawDeduction,
} from "@/lib/invoice-engine";

type Row = Record<string, unknown>;
export type UnitPeriod = { start: string; end: string };
export type BulkInvoiceUnit = {
  data: InvoiceUnitData;
  invoiceSplit: InvoiceSplit;
  extras: InvoiceExtraLike[];
  isInternal: boolean;
  unitName: string | null;
  customerName: string | null;
};

const s = (v: unknown) => String(v ?? "");
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** fetchPeriodContract, in memory: overlapping active/expired (latest start, active, newest), else latest active. */
export function choosePeriodContract(contracts: Row[], start: string, end: string): Row | null {
  const overlap = contracts
    .filter((c) => (c.status === "active" || c.status === "expired") && s(c.start_date) <= end && (!c.end_date || s(c.end_date) >= start))
    .sort((a, b) => s(b.start_date).localeCompare(s(a.start_date)) || s(a.status).localeCompare(s(b.status)) || s(b.created_at).localeCompare(s(a.created_at)));
  if (overlap[0]) return overlap[0];
  return contracts.filter((c) => c.status === "active").sort((a, b) => s(b.start_date).localeCompare(s(a.start_date)) || s(b.created_at).localeCompare(s(a.created_at)))[0] ?? null;
}

/**
 * Legacy flag pick (latest *active* contract overlapping the period). Invoices no
 * longer use it — their WO-as-Present / exact-day-rate flags come from the period
 * contract (choosePeriodContract) — but payroll-engine still calls it.
 */
export function chooseFlagContract(contracts: Row[], start: string, end: string): Row | null {
  return contracts
    .filter((c) => c.status === "active" && s(c.start_date) <= end && (!c.end_date || s(c.end_date) >= start))
    .sort((a, b) => s(b.start_date).localeCompare(s(a.start_date)) || s(b.created_at).localeCompare(s(a.created_at)))[0] ?? null;
}

/** Additions the invoice page loads for this site/period (same filters as its query). */
export function additionsForPeriod(rows: RawAddition[], rosterIds: Set<string>, unitId: string, start: string, end: string): RawAddition[] {
  return rows.filter((a) => {
    if (!rosterIds.has(a.candidate_id) || a.status !== "active") return false;
    const date = a.addition_date ? s(a.addition_date) : null;
    if (!date || date > end) return false;
    const inRange = date >= start || (a.repeat_monthly === true && (!a.end_date || s(a.end_date) >= start));
    if (!inRange) return false;
    return !a.unit_id || a.unit_id === unitId;
  });
}

export function deductionsForPeriod(rows: RawDeduction[], rosterIds: Set<string>, unitId: string, start: string, end: string): RawDeduction[] {
  return rows.filter((d) => {
    if (!rosterIds.has(d.candidate_id) || d.status !== "active") return false;
    const date = d.deduction_date ? s(d.deduction_date) : null;
    if (!date || date < start || date > end) return false;
    return !d.unit_id || d.unit_id === unitId;
  });
}

function mapExtra(r: Row): InvoiceExtraLike & { periodStart: string | null; periodEnd: string | null; description: string } {
  const quantity = Number(r.quantity) || 0;
  const rate = Number(r.rate) || 0;
  return {
    description: String(r.description ?? ""),
    periodStart: r.period_start ? s(r.period_start) : null,
    periodEnd: r.period_end ? s(r.period_end) : null,
    quantity,
    rate,
    enabled: r.enabled !== false,
    calcMode: r.calc_mode === "percent" ? "percent" : "amount",
    percent: Number(r.percent) || 0,
    baseOverride: r.base_override == null || r.base_override === "" ? null : Number(r.base_override),
    amount: Math.round(quantity * rate * 100) / 100,
  };
}

type RpcFn = (fn: string, args: Row) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args: Row, db = supabase) => (db.rpc as unknown as RpcFn)(fn, args);

/**
 * The invoice engine and the payroll engine load the very same period inputs,
 * contract lines and rate revisions for the same sites at the same moment.
 * Identical reads (same client, same arguments) started while one is in flight
 * — or within SHARED_READ_MS after it finished — share that one request. Every
 * caller gets its own deep copy, so neither engine can see the other's edits.
 * Browser only (display): server recomputes that save totals always read fresh.
 */
export const SHARED_READ_MS = 3_000;
let sharedReadsOnServer = false;
/** Tests only: exercise sharing outside a browser. */
export function enableSharedReadsForTest(on: boolean) { sharedReadsOnServer = on; }
const sharedReads = new WeakMap<object, Map<string, { at: number | null; promise: Promise<unknown> }>>();
export function sharedRead<T>(db: object, key: string, load: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined" && !sharedReadsOnServer) return load();
  let byKey = sharedReads.get(db);
  if (!byKey) sharedReads.set(db, (byKey = new Map()));
  const now = Date.now();
  for (const [k, e] of byKey) if (e.at !== null && now - e.at > SHARED_READ_MS) byKey.delete(k);
  let entry = byKey.get(key);
  if (!entry) {
    const promise = load();
    const created = { at: null as number | null, promise: promise as Promise<unknown> };
    entry = created;
    byKey.set(key, created);
    promise.then(
      () => { created.at = Date.now(); },
      () => { if (byKey!.get(key) === created) byKey!.delete(key); },
    );
  }
  return (entry.promise as Promise<T>).then((v) => structuredClone(v));
}
/** Max invoice_period_entries batches in flight at once. */
const PERIOD_BATCH_CONCURRENCY = 3;

export type PeriodInputs = {
  sites: Row[];
  contracts: Row[];
  primary: Row[];
  scopes: Row[];
  extras: Row[];
  entries: Map<string, AttendanceEntryFetchRow[]>;
  people: Map<string, Row>;
  links: Row[];
};

/** Site rows, contracts, rosters, postings and attendance of many sites, each over its own period. */
export async function fetchPeriodInputs(periods: Map<string, UnitPeriod>, db = supabase): Promise<PeriodInputs> {
  const list = [...periods].map(([u, p]) => ({ u, s: p.start, e: p.end }));
  const out: PeriodInputs = { sites: [], contracts: [], primary: [], scopes: [], extras: [], entries: new Map(), people: new Map(), links: [] };
  const size = 120;
  const batches: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += size) batches.push(list.slice(i, i + size));
  const run = async (batch: typeof list) => {
    const data = await sharedRead(db, `invoice_period_entries:${JSON.stringify(batch)}`, () => runBulk(async () => {
      const { data, error } = await rpc("invoice_period_entries", { p_units: batch }, db);
      if (error) throw error;
      return data ?? {};
    }));
    const payload = (data ?? {}) as {
      site?: Row[]; contracts?: Row[]; primary?: unknown[][]; scopes?: unknown[][]; extras?: Row[];
      links?: unknown[][]; people?: unknown[][]; c?: string[]; d?: string[];
      units?: { u: string; s: string; r: [number, number, number, string, number | null, number | null, number][] }[];
    };
    out.sites.push(...(payload.site ?? []));
    out.contracts.push(...(payload.contracts ?? []));
    out.extras.push(...(payload.extras ?? []));
    for (const [id, unit_id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date] of payload.primary ?? []) {
      out.primary.push({ id, unit_id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date });
    }
    for (const [scope_id, candidate_id] of payload.scopes ?? []) out.scopes.push({ scope_id, candidate_id });
    for (const [unit_id, candidate_id, shift_hours] of payload.links ?? []) out.links.push({ unit_id, candidate_id, shift_hours });
    for (const [id, unit_id, is_enabled, status, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date] of payload.people ?? []) {
      out.people.set(String(id), { id, unit_id, is_enabled, status, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date });
    }
    const c = payload.c ?? [];
    const d = payload.d ?? [];
    for (const unit of payload.units ?? []) {
      out.entries.set(unit.u, unit.r.map(([ci, di, off, code, ot, shift, rel]) => ({
        candidate_id: c[ci],
        designation_id: di >= 0 ? d[di] : null,
        entry_date: addDays(unit.s, off),
        code,
        ot_hours: ot,
        shift_hours: shift,
        is_reliever: rel === 1,
      })));
    }
  };
  await mapPool(batches, PERIOD_BATCH_CONCURRENCY, run);
  return out;
}

/** Contract lines in stored order (duplicate role lines: the later one prices, as on the invoice page). */
export async function fetchContractResources(contractIds: string[], db = supabase, concurrency = PERIOD_BATCH_CONCURRENCY): Promise<Row[]> {
  const size = 250;
  const batches: string[][] = [];
  for (let i = 0; i < contractIds.length; i += size) batches.push(contractIds.slice(i, i + size));
  const results = await mapPool(batches, concurrency, (ids) =>
    sharedRead(db, `invoice_contract_resources:${ids.join(",")}`, () => runBulk(async () => {
      const { data, error } = await rpc("invoice_contract_resources", { p_contract_ids: ids }, db);
      if (error) throw error;
      return (data ?? []) as Row[];
    })));
  return results.flat();
}

/** Every approved/expired rate revision (a small table) — the period helpers pick each line's own. */
export async function fetchAllRevisions(db = supabase): Promise<RateRevisionRow[] | null> {
  return sharedRead(db, "contract_rate_revisions:approved,expired", () => fetchInChunks<RateRevisionRow>(["all"], (_c, a, b) =>
      db.from("contract_rate_revisions" as never).select("*").in("status", ["approved", "expired"]).order("id").range(a, b)));
}

export async function loadInvoiceUnitsBulk(periods: Map<string, UnitPeriod>, db = supabase, context?: FinanceSharedContext | null): Promise<{ units: Map<string, BulkInvoiceUnit>; resources: Row[]; revisions: RateRevisionRow[] | null }> {
  const unitIds = [...periods.keys()];
  const units = new Map<string, BulkInvoiceUnit>();
  if (!unitIds.length) return { units, resources: [], revisions: null };
  const starts = [...periods.values()].map((p) => p.start).sort();
  const ends = [...periods.values()].map((p) => p.end).sort();
  const minStart = starts[0];
  const maxEnd = ends[ends.length - 1];
  // The register's shared reads, when made through this client and covering this batch.
  const sc = contextCovers(context, db, minStart, maxEnd) ? context : null;

  const [inputs, billingTypes, additionRows, deductionRows, revisions] = await Promise.all([
    fetchPeriodInputs(periods, db),
    // Browser client: the shared session-cached master. Other clients (server, tests): read directly.
    db === supabase
      ? getReference<Row>("billingTypes")
      : db.from("billing_types" as never).select("id, code").then((r) => (checkedQueryData(r) ?? []) as unknown as Row[]),
    // Additions: the single-site page's lower bound (dated in the window, or
    // repeating and still running at its start); additionsForPeriod is stricter.
    sc
      ? contextAdditions(sc, INVOICE_ADDITION_FIELDS, minStart, maxEnd)
      : fetchInChunks<Row>(["x"], (_c, a, b) => db.from("additions" as never).select(INVOICE_ADDITION_FIELDS.join(", ")).eq("status", "active").lte("addition_date", maxEnd).or(additionLowerBound(minStart)).order("id").range(a, b)),
    sc
      ? contextDeductions(sc, INVOICE_DEDUCTION_FIELDS, minStart, maxEnd)
      : fetchInChunks<Row>(["x"], (_c, a, b) => db.from("deductions" as never).select(INVOICE_DEDUCTION_FIELDS.join(", ")).eq("status", "active").gte("deduction_date", minStart).lte("deduction_date", maxEnd).order("id").range(a, b)),
    sc ? contextCopy(sc.revisions) : fetchAllRevisions(db),
  ]);
  const { sites: unitRows, contracts, primary: primaryRows, scopes: scopeRows, extras: extraRows } = inputs;
  const btCode = new Map(billingTypes.map((b) => [s(b.id), (b.code as string | null) ?? "man_days"]));
  const contractsByUnit = new Map<string, Row[]>();
  for (const c of contracts) {
    const list = contractsByUnit.get(s(c.unit_id)) ?? [];
    list.push(c);
    contractsByUnit.set(s(c.unit_id), list);
  }
  const periodContract = new Map<string, Row>();
  for (const [unitId, p] of periods) {
    const c = choosePeriodContract(contractsByUnit.get(unitId) ?? [], p.start, p.end);
    if (c) periodContract.set(unitId, c);
  }
  const contractIds = Array.from(new Set([...periodContract.values()].map((c) => s(c.id))));
  const resources = await fetchContractResources(contractIds, db);
  const resourcesByContract = new Map<string, Row[]>();
  for (const r of resources) {
    const list = resourcesByContract.get(s(r.contract_id)) ?? [];
    const { contract_id: _omit, ...rest } = r;
    void _omit;
    list.push(rest);
    resourcesByContract.set(s(r.contract_id), list);
  }

  const primaryByUnit = new Map<string, InvoiceCandidate[]>();
  for (const c of primaryRows) {
    const list = primaryByUnit.get(s(c.unit_id)) ?? [];
    list.push(c as unknown as InvoiceCandidate);
    primaryByUnit.set(s(c.unit_id), list);
  }
  const linkRows = inputs.links;
  const linksByUnit = new Map<string, { candidate_id: string; shift_hours?: number | null }[]>();
  for (const l of linkRows) {
    const list = linksByUnit.get(s(l.unit_id)) ?? [];
    list.push({ candidate_id: s(l.candidate_id), shift_hours: l.shift_hours as number | null });
    linksByUnit.set(s(l.unit_id), list);
  }
  const scopesByUnit = new Map<string, string[]>();
  for (const sc of scopeRows) {
    const list = scopesByUnit.get(s(sc.scope_id)) ?? [];
    list.push(s(sc.candidate_id));
    scopesByUnit.set(s(sc.scope_id), list);
  }

  // Profiles of linked and attended people (any unit / status), from the same read as attendance.
  const entriesByUnit = inputs.entries;
  const candById = inputs.people;
  const strip = (c: Row): InvoiceCandidate => ({
    id: s(c.id),
    employee_code: (c.employee_code as string | null) ?? null,
    full_name: (c.full_name as string | null) ?? null,
    designation_id: (c.designation_id as string | null) ?? null,
    gender: (c.gender as string | null) ?? null,
    is_disabled: (c.is_disabled as boolean | null) ?? null,
    preferred_joining_date: (c.preferred_joining_date as string | null) ?? null,
  });

  const unitById = new Map(unitRows.map((u) => [s(u.id), u]));
  const extrasByUnit = new Map<string, ReturnType<typeof mapExtra>[]>();
  for (const e of extraRows) {
    const list = extrasByUnit.get(s(e.unit_id)) ?? [];
    list.push({ ...mapExtra(e), sortOrder: Number(e.sort_order) || 0, description: s(e.description) } as never);
    extrasByUnit.set(s(e.unit_id), list);
  }

  for (const [unitId, p] of periods) {
    const unit = unitById.get(unitId);
    const contract = periodContract.get(unitId) ?? null;
    if (!unit || !contract) continue;
    const primary = (primaryByUnit.get(unitId) ?? []).map((c) => strip(c as unknown as Row));
    const links = linksByUnit.get(unitId) ?? [];
    const secondary = Array.from(new Set(links.map((l) => l.candidate_id)))
      .map((id) => candById.get(id))
      .filter((c): c is Row => !!c && c.is_enabled === true && c.status === "active")
      .map(strip);
    const have = new Set([...primary, ...secondary].map((c) => c.id));
    const entries = entriesByUnit.get(unitId) ?? [];
    const attendedIds = Array.from(new Set(entries.map((e) => e.candidate_id)));
    const attendedRows = attendedIds.map((id) => candById.get(id)).filter((c): c is Row => !!c);
    const visible = visibleAttendanceCandidateIds(
      unitId,
      attendedRows.map((c) => ({ id: s(c.id), unit_id: (c.unit_id as string | null) ?? null, is_enabled: (c.is_enabled as boolean | null) ?? null, status: (c.status as string | null) ?? null })),
      links.map((l) => l.candidate_id),
      scopesByUnit.get(unitId) ?? [],
    ).filter((id) => !have.has(id));
    const leavers = visible.map((id) => strip(candById.get(id)!));
    const rosterIds = new Set([...primary, ...secondary, ...leavers].map((c) => c.id));
    // WO-as-Present / exact-day-rate from the period contract that prices this invoice.
    const flags = contract;
    const ptStateRaw = (unit.pt_state as string | null) || null;
    const customer = { name: (unit.customer_name as string | null) ?? null, invoice_split: unit.customer_invoice_split };
    const data: InvoiceUnitData = {
      unitId,
      start: p.start,
      end: p.end,
      unitCode: (unit.code as string | null) ?? null,
      customerName: customer?.name ?? null,
      epfCapEnabled: (unit.epf_cap_enabled as boolean | null) ?? true,
      ptState: ptStateRaw || ((unit.billing_state as string | null) ?? null),
      ptPincode: ptStateRaw ? null : ((unit.billing_pincode as string | null) ?? null),
      unitPh: unitPhFromRow(unit as never),
      woAsPresent: Boolean(flags?.wo_as_present),
      exactDayRate: Boolean(flags?.exact_day_rate),
      primary,
      links,
      secondary,
      leavers,
      entries,
      periodContract: contract,
      billingMode: contract.billing_type_id ? billingModeFromCode(btCode.get(s(contract.billing_type_id)) ?? "man_days") : "man_days",
      resources: resourcesByContract.get(s(contract.id)) ?? [],
      revisions,
      additions: additionsForPeriod(additionRows as unknown as RawAddition[], rosterIds, unitId, p.start, p.end),
      deductions: deductionsForPeriod(deductionRows as unknown as RawDeduction[], rosterIds, unitId, p.start, p.end),
    };
    const extras = (extrasByUnit.get(unitId) ?? [])
      .filter((c) => !c.periodStart || (c.periodStart === p.start && c.periodEnd === p.end))
      .sort((a, b) => ((a as never as { sortOrder: number }).sortOrder - (b as never as { sortOrder: number }).sortOrder) || String((a as never as { description: string }).description).localeCompare(String((b as never as { description: string }).description)));
    units.set(unitId, {
      data,
      invoiceSplit: resolveOrgInvoiceSplit(contract as never, customer?.invoice_split),
      extras,
      isInternal: contract.is_internal === true,
      unitName: (unit.name as string | null) ?? null,
      customerName: customer?.name ?? null,
    });
  }
  return { units, resources, revisions };
}
