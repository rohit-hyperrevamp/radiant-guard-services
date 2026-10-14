import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "../pchk/shim";
const m: any = await import("@/routes/admin.contracts.client-contracts");
const RID = process.argv[2] ?? "09502df7-e024-44e3-abaf-06458bcad5a7";
const { data: r } = await supabase.from("contract_resources").select("*").eq("id", RID).single();
const initial = { id: r.id, designationId: r.designation_id ?? "", roleKey: r.role_key, serviceTypeId: r.service_type_id ?? "", quantity: r.quantity, shiftHours: r.shift_hours === 12 ? 12 : 8, components: r.components, payrollDayBaseId: r.payroll_day_base_id, billingDayBaseId: r.billing_day_base_id, benefits: r.benefits ?? [], deductions: r.deductions ?? [], employerContributions: r.employer_contributions ?? [], roundOffFinal: !!r.round_off_final, roundOffTotals: r.round_off_totals ?? {}, otMultiplier: Number(r.ot_multiplier ?? 1) };
const qc = new QueryClient();
let submitted: any = null;
const el = document.createElement("div"); document.body.appendChild(el);
const root = createRoot(el);
function Loader() { m.useAllowanceTypes(); m.useCostComponentOptions(); m.usePayrollDayBases(); m.useBillingDayBases(); return null; }
await act(async () => { root.render(<QueryClientProvider client={qc}><Loader /></QueryClientProvider>); });
for (let i = 0; i < 40; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 250)); }); if (qc.isFetching() === 0) break; }
console.log("prefetched", qc.getQueryCache().getAll().map((q: any) => q.queryKey.join("/") + ":" + (q.state.data?.length ?? "-")).join(", "));
await act(async () => { root.render(<QueryClientProvider client={qc}><Loader /><m.ResourceFormDialog open onOpenChange={() => {}} initial={initial} onSubmit={(x: any) => { submitted = x; }} /></QueryClientProvider>); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
await act(async () => { await wait(2000); });
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
const combos = () => Array.from(document.querySelectorAll('button[role="combobox"]')) as HTMLButtonElement[];
console.log("combos:", combos().map((b) => b.textContent).join(" | "));
for (const kind of ["reliever", "mgmt"]) {
  const label = kind === "mgmt" ? /management|mgmt|Not applicable/i : /reliev|Not applicable/i;
  const card = Array.from(document.querySelectorAll("label")).find((l) => (l.textContent ?? "").toLowerCase() === (kind === "mgmt" ? "management fee" : "reliever charges"))?.parentElement;
  const trig = card?.querySelector('button[role="combobox"]') as HTMLButtonElement;
  console.log(kind, "current:", trig?.textContent);
  await act(async () => { trig.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 } as any)); trig.click(); });
  await act(async () => { await wait(200); });
  const opt = Array.from(document.querySelectorAll('[cmdk-item]')).find((o) => /Custom amount/.test(o.textContent ?? "")) as HTMLElement;
  console.log(" custom option found:", !!opt);
  await act(async () => { opt?.click(); });
  await act(async () => { await wait(300); });
  const inp = document.querySelector(`#custom-${kind}-amount`) as HTMLInputElement | null;
  console.log(" box present:", !!inp, "value:", inp?.value);
  if (inp) {
    for (const v of ["5", "55", "555"]) { await act(async () => { setter.call(inp, v); inp.dispatchEvent(new Event("input", { bubbles: true })); }); await act(async () => { await wait(150); }); }
    console.log(" after typing:", (document.querySelector(`#custom-${kind}-amount`) as HTMLInputElement | null)?.value);
  }
}
await act(async () => { await wait(1500); });
console.log("after wait box:", (document.querySelector("#custom-mgmt-amount") as HTMLInputElement | null)?.value);
const btn = Array.from(document.querySelectorAll("button")).find((b) => /Save Resource|Add Resource/.test(b.textContent ?? ""));
await act(async () => { btn?.click(); });
const fees = (submitted?.employerContributions ?? []).filter((x: any) => /manage|reliev/i.test(x.name));
console.log("submitted fees:", JSON.stringify(fees.map((f: any) => [f.name, f.amount, f.costComponentId])));
process.exit(0);
