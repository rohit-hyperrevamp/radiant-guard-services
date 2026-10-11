import { useQuery } from "@tanstack/react-query";
import { differenceInMonths, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");
const inr = (n?: number | null) => (n == null ? "—" : `₹${Math.round(Number(n)).toLocaleString("en-IN")}`);

type Summary = {
  full_name: string;
  employee_code: string | null;
  mobile: string | null;
  email: string | null;
  status: string | null;
  is_enabled: boolean | null;
  date_of_birth: string | null;
  joined_on: string | null;
  offboarded_at: string | null;
  offboarding_reason: string | null;
  no_hire: boolean | null;
  designation: string | null;
  department: string | null;
  address: string | null;
  home_unit: { name: string; code: string | null } | null;
  units: { name: string; code: string | null; client: string | null; is_primary: boolean; is_reliever: boolean; designation: string | null; since: string }[];
  managers: { name: string; mobile: string | null; code: string | null; designation: string | null; is_primary: boolean }[];
  reports_to: { name: string; mobile: string | null } | null;
  payslips: { period_label: string; unit: string | null; paid_days: number; ed_days: number; gross: number; deductions: number; net_pay: number; earnings: Record<string, number> | null }[];
  units_paid_at: number;
  total_paid_days: number;
  cases: { case_number: string; title: string; status: string }[];
};

function tenure(from?: string | null, to?: string | null) {
  if (!from) return "—";
  const m = differenceInMonths(to ? new Date(to) : new Date(), new Date(from));
  if (m < 1) return "Under a month";
  const y = Math.floor(m / 12);
  return [y ? `${y} yr` : "", m % 12 ? `${m % 12} mo` : ""].filter(Boolean).join(" ");
}

export function EmployeeSummaryView({ candidateId }: { candidateId: string }) {
  const q = useQuery({
    queryKey: ["legal-employee-summary", candidateId],
    queryFn: async () => {
      const { data, error } = await db.rpc("legal_employee_summary", { _candidate_id: candidateId });
      if (error) throw error;
      return data as Summary;
    },
  });
  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>;
  const s = q.data;
  if (!s) return <div className="p-6 text-sm text-muted-foreground">Employee not found.</div>;
  const latest = s.payslips[0];
  const fo = s.managers.find((m) => m.is_primary) ?? s.managers[0] ?? s.reports_to;
  const info: [string, string][] = [
    ["Employee ID", s.employee_code ?? "—"],
    ["Phone", s.mobile ?? "—"],
    ["Designation", s.designation ?? "—"],
    ["Department", s.department ?? "—"],
    ["Status", `${s.status ?? "—"}${s.is_enabled === false ? " (disabled)" : ""}`],
    ["Joined", d(s.joined_on)],
    ["Left", s.offboarded_at ? `${d(s.offboarded_at)}${s.offboarding_reason ? ` · ${s.offboarding_reason}` : ""}` : "Still working"],
    ["Time with us", tenure(s.joined_on, s.offboarded_at)],
    ["Primary unit", s.home_unit ? `${s.home_unit.name}${s.home_unit.code ? ` (${s.home_unit.code})` : ""}` : "—"],
    ["Paid days (all time)", String(s.total_paid_days ?? 0)],
    ["Sites paid at", String(s.units_paid_at ?? 0)],
    ["Date of birth", d(s.date_of_birth)],
  ];
  return (
    <div className="space-y-4 text-sm">
      {s.no_hire && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">Marked do-not-rehire</div>
      )}
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k}>
            <div className="text-muted-foreground">{k}</div>
            <div className="capitalize-first font-medium text-foreground">{v}</div>
          </div>
        ))}
        {s.address && (
          <div className="col-span-2 sm:col-span-3">
            <div className="text-muted-foreground">Address</div>
            <div>{s.address}</div>
          </div>
        )}
      </div>
      <div>
        <div className="mb-1 font-medium">Field Officer / reporting manager</div>
        {fo ? (
          <div className="rounded-md border border-border px-3 py-2 text-xs">
            <span className="font-medium">{fo.name}</span> · {fo.mobile ?? "no phone"}
            {"designation" in fo && fo.designation ? ` · ${fo.designation}` : ""}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Not mapped.</div>
        )}
      </div>
      <div>
        <div className="mb-1 font-medium">Where they worked</div>
        <div className="space-y-1">
          {s.units.map((u, i) => (
            <div key={i} className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">
              <span className="font-medium">{u.name}</span>
              {u.code ? ` (${u.code})` : ""} · {u.client ?? "—"} · {u.designation ?? "—"}
              {u.is_primary ? " · Primary" : u.is_reliever ? " · Reliever" : ""} · since {d(u.since)}
            </div>
          ))}
          {s.units.length === 0 && <div className="text-xs text-muted-foreground">No sites mapped.</div>}
        </div>
      </div>
      {latest && (
        <div>
          <div className="mb-1 font-medium">Salary structure (latest payslip, {latest.period_label})</div>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-2 text-xs sm:grid-cols-3">
            {Object.entries(latest.earnings ?? {})
              .filter(([, v]) => typeof v === "number" && v !== 0)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">{k}</span>
                  <span className="tabular-nums">{inr(v)}</span>
                </div>
              ))}
            <div className="col-span-full mt-1 flex flex-wrap gap-x-4 border-t border-border pt-1 font-medium">
              <span>Gross {inr(latest.gross)}</span>
              <span>Deductions {inr(latest.deductions)}</span>
              <span>Net {inr(latest.net_pay)}</span>
            </div>
          </div>
        </div>
      )}
      <div>
        <div className="mb-1 font-medium">Recent payslips</div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">Month</th>
                <th className="px-2 py-1 text-left">Site</th>
                <th className="px-2 py-1 text-right">Days</th>
                <th className="px-2 py-1 text-right">ED</th>
                <th className="px-2 py-1 text-right">Gross</th>
                <th className="px-2 py-1 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {s.payslips.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1">{p.period_label}</td>
                  <td className="px-2 py-1">{p.unit ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.paid_days}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.ed_days}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{inr(p.gross)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{inr(p.net_pay)}</td>
                </tr>
              ))}
              {s.payslips.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-center text-muted-foreground">No payslips yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {s.cases.length > 0 && (
        <div>
          <div className="mb-1 font-medium">Cases involving this employee</div>
          {s.cases.map((c) => (
            <div key={c.case_number} className="text-xs">
              {c.case_number} · {c.title} · {c.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmployeeSummaryDialog({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Employee summary</DialogTitle>
        </DialogHeader>
        <EmployeeSummaryView candidateId={candidateId} />
      </DialogContent>
    </Dialog>
  );
}
