import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "../pchk/shim";
const m: any = await import("@/routes/admin.contracts.client-contracts");
const qc = new QueryClient();
const el = document.createElement("div"); document.body.appendChild(el);
const root = createRoot(el);
function Loader() { m.useAllowanceTypes(); m.useCostComponentOptions(); m.usePayrollDayBases(); m.useBillingDayBases(); return null; }
await act(async () => { root.render(<QueryClientProvider client={qc}><Loader /></QueryClientProvider>); });
for (let i = 0; i < 40; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 250)); }); if (qc.isFetching() === 0) break; }
await act(async () => { root.render(<QueryClientProvider client={qc}><Loader /><m.ResourceFormDialog open onOpenChange={() => {}} initial={null} onSubmit={() => {}} /></QueryClientProvider>); });
for (let i = 0; i < 40; i++) { await act(async () => { await new Promise((r) => setTimeout(r, 250)); }); if (qc.isFetching() === 0) break; }
const ids = ["09502df7-e024-44e3-abaf-06458bcad5a7", "0e30cb0c-6932-4983-b16e-0cf785554658"];
const { data: rows } = await supabase.from("contract_resources").select("*").in("id", ids);
const resources = rows!.map((r: any) => ({ id: r.id, designationId: r.designation_id ?? "", roleKey: r.role_key, serviceTypeId: r.service_type_id ?? "", quantity: r.quantity, shiftHours: r.shift_hours === 12 ? 12 : 8, components: r.components, payrollDayBaseId: r.payroll_day_base_id, billingDayBaseId: r.billing_day_base_id, benefits: r.benefits ?? [], deductions: r.deductions ?? [], employerContributions: r.employer_contributions ?? [], roundOffFinal: !!r.round_off_final, roundOffTotals: r.round_off_totals ?? {}, otMultiplier: Number(r.ot_multiplier ?? 1) }));
const cache = qc.getQueryCache().getAll().map((q: any) => ({ key: q.queryKey, data: q.state.data }));
await Bun.write("/dev-server/src/zz-fee-fixture.json", JSON.stringify({ cache, resources }));
console.log(cache.map((c: any) => c.key.join("/") + ":" + (c.data?.length ?? "-")).join(", "));
process.exit(0);
