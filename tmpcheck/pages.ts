const P = (await import("@/lib/server-env")).PRODUCTION_SUPABASE;
const MONTH = process.argv[2] ?? "2026-09";
for (const k of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) process.env[k] = P.SUPABASE_URL;
for (const k of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) process.env[k] = P.SUPABASE_SERVICE_ROLE_KEY;
const { supabase } = await import("@/integrations/supabase/client");
const E = await import("@/lib/invoice-engine");
const { loadOrgInvoiceSplit } = await import("@/lib/invoice-split");
const { resolveExtraCharges } = await import("@/components/InvoiceExtraCharges");
const { computePayrollUnitRows } = await import("@/lib/payroll-engine");
const { fetchEnabledPublicHolidays, holidayMapForDates } = await import("@/lib/public-holidays");
const { fetchPlatformFlag, PLATFORM_SETTING_KEYS } = await import("@/lib/platform-settings");
const fs = await import("fs");
const OUT = `/tmp/rls/pages-${MONTH}.jsonl`;
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).u) : []);
const list = (JSON.parse(fs.readFileSync(`/tmp/rls/admin-${MONTH}.json`, "utf8")) as any[]).filter((x) => !done.has(x.u));
const holidays = await fetchEnabledPublicHolidays();
const esiRoundUp = (await (fetchPlatformFlag as any)(PLATFORM_SETTING_KEYS.esiRoundUp, true)) as boolean;
const ptSlabs = (await supabase.from("professional_tax_slabs").select("id, state, region_label, salary_min, salary_max, tax_per_month, gender")).data as any;
const pincodeRanges = (await supabase.from("pincode_ranges").select("state, region_label, range_start, range_end, is_excluded")).data as any;
const lwfRows = (await supabase.from("labour_welfare_funds").select("id, state, deduction_months, frequency, employee_contribution, employer_contribution, enabled, notes")).data as any;
const G = await E.loadInvoiceGlobals();
console.log("todo", list.length, "esiRoundUp", esiRoundUp);
const deadline = Date.now() + Number(process.argv[3] ?? 540) * 1000;
let i = 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
async function one(x: any) {
  const u = x.u, start = x.s, end = x.e;
  // invoice page
  const d = await E.loadInvoiceUnitData(u, start, end);
  const res = E.computeInvoiceUnit(d, { ...G, masters: await E.loadFormulaMastersFor(d.resources, d.revisions) });
  const { data: unit } = await supabase.from("units").select("customer_id, billing_state, billing_pincode, pt_state, epf_cap_enabled, ph_enabled, ph_multiplier, ph_day_value, ph_excluded_candidate_ids, ph_excluded_days" as never).eq("id", u).maybeSingle();
  const un: any = unit;
  const split = await loadOrgInvoiceSplit(un?.customer_id ?? null, res.contractId);
  const { data: ex } = await supabase.from("invoice_extra_charges" as never).select("*").eq("unit_id", u);
  const extras = ((ex ?? []) as any[]).filter((c) => !c.period_start || (c.period_start === start && c.period_end === end)).map((r) => ({ quantity: +r.quantity || 0, rate: +r.rate || 0, enabled: r.enabled !== false, calcMode: r.calc_mode === "percent" ? "percent" : "amount", percent: +r.percent || 0, baseOverride: r.base_override == null || r.base_override === "" ? null : Number(r.base_override), amount: Math.round((+r.quantity || 0) * (+r.rate || 0) * 100) / 100 })) as any;
  const tx = E.invoiceUnitTaxable(res, { unitId: u, unitCode: d.unitCode, customerName: d.customerName, invoiceSplit: split, exactDayRate: d.exactDayRate }, extras);
  // payroll page
  const periodDates = E.invoicePeriodDates(start, end);
  const dv = un?.ph_day_value;
  const unitPh = { enabled: Boolean(un?.ph_enabled), multiplier: Number(un?.ph_multiplier ?? 1) || 1, excluded: (un?.ph_excluded_candidate_ids ?? []).map(String), excludedDays: (un?.ph_excluded_days ?? []).map(String), dayValue: !un?.ph_enabled ? 0 : dv == null || Number.isNaN(Number(dv)) ? null : Number(dv) };
  const phConfig = (() => { if (!unitPh.enabled) return null; const m = holidayMapForDates(periodDates, holidays); if (!m.size) return null; return { dates: [...m.keys()], multiplier: unitPh.multiplier }; })();
  const { data: wo } = await supabase.from("client_contracts").select("wo_as_present" as never).eq("unit_id", u).eq("record_type", "client").eq("status", "active").lte("start_date", end).or(`end_date.is.null,end_date.gte.${start}`).order("start_date", { ascending: false }).limit(1);
  const woAsPresent = Boolean(((wo ?? [])[0] as any)?.wo_as_present);
  const ptState = un?.pt_state || un?.billing_state || null;
  const ptPincode = un?.pt_state ? null : un?.billing_pincode ?? null;
  const pr: any = await computePayrollUnitRows({ unitId: u, start, end, periodDates, ptState, ptPincode, epfCapEnabled: un?.epf_cap_enabled ?? true, esiRoundUp, woAsPresent, unitPh, phConfig, ptSlabs, pincodeRanges, lwfRows } as any);
  const rows = (Array.isArray(pr) ? pr : pr.rows) as any[];
  let g = 0, er = 0;
  for (const r of rows) { if (!r.wages) continue; g += r.wages.earnedGross; er += r.wages.totalEmployerContributions; }
  fs.appendFileSync(OUT, JSON.stringify({ u, code: d.unitCode, taxable: tx.taxable, gross: r2(g), er: r2(er) }) + "\n");
}
async function w() { while (i < list.length && Date.now() < deadline) { const x = list[i++]; try { await one(x); } catch (e: any) { console.log("ERR", x.code, String(e?.message ?? e).slice(0, 150)); } } }
await Promise.all(Array.from({ length: 12 }, w));
console.log("done", i, "of", list.length);
process.exit(0);
