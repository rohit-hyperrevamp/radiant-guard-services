const prod = "https://yimpxawqoarprhtxapie.supabase.co";
const key = (await import("@/lib/server-env")).PRODUCTION_SUPABASE.SUPABASE_SERVICE_ROLE_KEY;
for (const k of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) process.env[k] = prod;
for (const k of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) process.env[k] = key;
const { supabase } = await import("@/integrations/supabase/client");
const E = await import("@/lib/invoice-engine");
const B = await import("@/lib/invoice-engine-bulk");
const { loadOrgInvoiceSplit } = await import("@/lib/invoice-split");
const { writeFileSync } = await import("fs");
const LIMIT = Number(process.argv[2] ?? 60);
const { data: sheets } = await supabase.from("attendance_sheets" as never).select("unit_id, period_start, period_end").gte("period_end", "2026-09-01").lte("period_end", "2026-09-30").order("unit_id").limit(5000);
const periods = new Map<string, { start: string; end: string }>();
for (const s of (sheets ?? []) as any[]) periods.set(s.unit_id, { start: s.period_start, end: s.period_end });
console.log("units", periods.size);
let t = Date.now();
const bulk = await B.loadInvoiceUnitsBulk(periods);
console.log("bulk load ms", Date.now() - t, bulk.units.size);
const G = await E.loadInvoiceGlobals(bulk.resources, bulk.revisions);
t = Date.now();
const bulkTotals = new Map<string, number>();
for (const [u, x] of bulk.units) {
  const res = E.computeInvoiceUnit(x.data, G);
  const tx = E.invoiceUnitTaxable(res, { unitId: u, unitCode: x.data.unitCode, customerName: x.customerName, invoiceSplit: x.invoiceSplit, exactDayRate: x.data.exactDayRate }, x.extras);
  bulkTotals.set(u, x.isInternal ? 0 : tx.taxable);
}
console.log("bulk compute ms", Date.now() - t);
writeFileSync("/tmp/eng/bulk.json", JSON.stringify([...bulkTotals]));
// Per-unit (invoice page path) on a sample
const sample = [...bulk.units.keys()].sort(() => Math.random() - 0.5).slice(0, LIMIT);
let bad = 0, n = 0;
const out: any[] = [];
for (const u of sample) {
  const p = periods.get(u)!;
  const d = await E.loadInvoiceUnitData(u, p.start, p.end);
  const g = { ...G, masters: (await E.loadFormulaMastersFor(d.resources, d.revisions)) };
  const res = E.computeInvoiceUnit(d, g);
  const { data: unit } = await supabase.from("units").select("customer_id").eq("id", u).maybeSingle();
  const split = await loadOrgInvoiceSplit((unit as any)?.customer_id ?? null, res.contractId);
  const { data: ex } = await supabase.from("invoice_extra_charges" as never).select("*").eq("unit_id", u);
  const extras = ((ex ?? []) as any[]).filter((c) => !c.period_start || (c.period_start === p.start && c.period_end === p.end)).map((r) => ({ quantity: +r.quantity || 0, rate: +r.rate || 0, enabled: r.enabled !== false, calcMode: r.calc_mode === "percent" ? "percent" : "amount", percent: +r.percent || 0, baseOverride: r.base_override == null || r.base_override === "" ? null : Number(r.base_override), amount: Math.round((+r.quantity || 0) * (+r.rate || 0) * 100) / 100 })) as any;
  const tx = E.invoiceUnitTaxable(res, { unitId: u, unitCode: d.unitCode, customerName: d.customerName, invoiceSplit: split, exactDayRate: d.exactDayRate }, extras);
  const internal = bulk.units.get(u)!.isInternal;
  const page = internal ? 0 : tx.taxable;
  const b = bulkTotals.get(u)!;
  n++;
  if (Math.abs(page - b) > 0.01) { bad++; out.push({ u, code: d.unitCode, page, b }); }
}
console.log("per-unit compared", n, "mismatch", bad);
console.log(JSON.stringify(out.slice(0, 20)));
process.exit(0);
