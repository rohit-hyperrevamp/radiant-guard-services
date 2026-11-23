const prod = "https://yimpxawqoarprhtxapie.supabase.co";
const key = (await import("@/lib/server-env")).PRODUCTION_SUPABASE.SUPABASE_SERVICE_ROLE_KEY;
for (const k of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) process.env[k] = prod;
for (const k of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) process.env[k] = key;
const { supabase } = await import("@/integrations/supabase/client");
const E = await import("@/lib/invoice-engine");
const R = await import("./ref");
const { loadOrgInvoiceSplit, isSplit } = await import("@/lib/invoice-split");
const { fetchEnabledPublicHolidays, holidayMapForDates } = await import("@/lib/public-holidays");
const N = Number(process.argv[2] ?? 30);
const { data: sheets } = await supabase.from("attendance_sheets" as never).select("unit_id, period_start, period_end").gte("period_end", "2026-09-01").lte("period_end", "2026-09-30").order("id").range(0, 999);
const list = ((sheets ?? []) as any[]).sort(() => Math.random() - 0.5).slice(0, N);
const holidays = await fetchEnabledPublicHolidays();
const G0 = await E.loadInvoiceGlobals();
let bad = 0;
for (const s of list) {
  const u = s.unit_id, start = s.period_start, end = s.period_end;
  const periodDates = E.invoicePeriodDates(start, end);
  const { data: unitRow } = await supabase.from("units").select("id, code, customer_id, epf_cap_enabled, billing_state, billing_pincode, pt_state, ph_enabled, ph_multiplier, ph_day_value, ph_excluded_candidate_ids, ph_excluded_days, customers(name)" as never).eq("id", u).maybeSingle();
  const un: any = unitRow;
  const unitPh = E.unitPhFromRow(un);
  const phConfig = (() => { if (!unitPh.enabled) return null; const m = holidayMapForDates(periodDates, holidays); if (!m.size) return null; return { dates: [...m.keys()], multiplier: unitPh.multiplier }; })();
  const { data: fl } = await supabase.from("client_contracts").select("wo_as_present, exact_day_rate" as never).eq("unit_id", u).eq("record_type", "client").eq("status", "active").lte("start_date", end).or(`end_date.is.null,end_date.gte.${start}`).order("start_date", { ascending: false }).limit(1);
  const f: any = (fl ?? [])[0];
  const ptState = un.pt_state || un.billing_state; const ptPincode = un.pt_state ? null : un.billing_pincode;
  const ref: any = await R.refCompute(u, start, end, { unitPh, phConfig, woAsPresent: !!f?.wo_as_present, ptState, ptPincode, epfCapEnabled: un.epf_cap_enabled ?? true, ptSlabs: G0.ptSlabs, pincodeRanges: G0.pincodeRanges, lwfRows: G0.lwfRows, periodDates });
  const split = await loadOrgInvoiceSplit(un.customer_id, ref.contractId);
  const unitCtx = { code: un.code, customer_name: un.customers?.name ?? "" };
  const math = R.refMath(ref, { unitId: u, unit: unitCtx, billingMode: ref.billingMode, invoiceSplit: split, periodDates, exactDayRate: !!f?.exact_day_rate });
  const parts = isSplit(split) ? split.parts.map((p) => p.key) : ["main"];
  let refTotal = 0;
  for (const p of parts) { const rows = E.invoicePartRows(ref.rows, split, p, ref.billingMode); let a = 0; for (const r of rows) { if (!r.wages) continue; a += math(r).actual; } refTotal += Math.round(a * 100) / 100; }
  const d = await E.loadInvoiceUnitData(u, start, end);
  const res = E.computeInvoiceUnit(d, { ...G0, masters: await E.loadFormulaMastersFor(d.resources, d.revisions) });
  const tx = E.invoiceUnitTaxable(res, { unitId: u, unitCode: d.unitCode, customerName: d.customerName, invoiceSplit: split, exactDayRate: d.exactDayRate }, []);
  const eng = tx.parts.reduce((x, p) => x + p.billed, 0);
  const rowsOk = ref.rows.length === res.rows.length;
  if (Math.abs(refTotal - eng) > 0.005 || !rowsOk) { bad++; console.log("MISMATCH", un.code, refTotal, eng, ref.rows.length, res.rows.length); }
}
console.log("compared", list.length, "mismatch", bad);
process.exit(0);
