import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { z } from "zod";

import { PayrollTabs } from "@/components/PayrollTabs";
import { HeroTile } from "@/components/HeroTile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton } from "@/components/Skeletons";
import { FinanceCharter } from "@/components/FinanceCharter";
import { PayrollWindowPeriodPicker } from "@/components/PayrollWindowPeriodPicker";
import { CHARTER_UNITS_QK, fetchCharterUnits } from "@/lib/charter-units";
import { formatPayrollPeriod, payrollPeriodForMonth } from "@/lib/payroll-period";
import { usePayrollWindowSelection } from "@/lib/use-payroll-window-selection";
import { useFieldOfficerUnitScope } from "@/lib/use-fo-unit-scope";

const searchSchema = z.object({ window: z.string().optional(), month: z.coerce.number().min(0).max(11).optional(), year: z.coerce.number().min(2000).max(2100).optional() });

export const Route = createFileRoute("/admin/payroll/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PayrollUnitsPage,
});

function PayrollUnitsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: CHARTER_UNITS_QK,
    queryFn: fetchCharterUnits,
  });

  const foScope = useFieldOfficerUnitScope();
  const rawUnits = data?.units ?? [];
  const units = useMemo(
    () => (foScope.isFieldOfficer ? rawUnits.filter((u) => foScope.unitIds.has(u.id)) : rawUnits),
    [rawUnits, foScope.isFieldOfficer, foScope.unitIds],
  );
  const periodSelection = usePayrollWindowSelection(units.map((unit) => unit.id), search);
  const { monthIdx, year, selectedKey, selectedWindow, windowsByUnit, unitIdsForWindow } = periodSelection;
  const windowUnits = useMemo(() => units.filter((unit) => unitIdsForWindow.has(unit.id)), [units, unitIdsForWindow]);
  const selectedPeriod = payrollPeriodForMonth(year, monthIdx, selectedWindow);
  useEffect(() => {
    if (!selectedKey) return;
    void navigate({ search: { window: selectedKey, month: monthIdx, year }, replace: true });
  }, [monthIdx, navigate, selectedKey, year]);
  const organizations = useMemo(() => {
    const all = data?.organizations ?? [];
    if (!foScope.isFieldOfficer) return all;
    const allowed = new Set(windowUnits.map((u) => u.customer_id));
    return all.filter((o) => allowed.has(o.id));
  }, [data?.organizations, foScope.isFieldOfficer, windowUnits]);

  const summary = {
    organizations: organizations.length,
    units: windowUnits.length,
    activeEmployees: windowUnits.reduce((s, r) => s + r.active_employee_count, 0),
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return windowUnits.filter((u) => {
      if (orgFilter !== "all" && (u.customer_id || u.customer_name) !== orgFilter) return false;
      if (unitFilter !== "all" && u.id !== unitFilter) return false;
      if (term) {
        const hay = [u.customer_name, u.customer_code, u.name, u.code, u.location, ...u.contract_codes]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [q, orgFilter, unitFilter, windowUnits]);

  const anyFilter = orgFilter !== "all" || unitFilter !== "all" || q.trim().length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PayrollTabs />

      <HeroTile
        eyebrow="Payroll period"
        title={formatPayrollPeriod(selectedPeriod)}
        subtitle={selectedWindow?.label ?? "Contract window"}
        description="Payroll from approved attendance."
        right={
          <PayrollWindowPeriodPicker options={periodSelection.options} selectedKey={selectedKey} year={year} monthIdx={monthIdx} onWindowChange={periodSelection.selectWindow} onCycleChange={periodSelection.shiftCycle} />
        }
      />

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm shadow-stone-200/40 dark:shadow-black/20">
        <div className="space-y-3 border-b border-border/60 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              Payroll charter
            </h2>
            <p className="text-[12px] leading-relaxed text-muted-foreground sm:text-sm">
              Month-till-date payroll by unit. Open any unit for the full payroll register.
            </p>
          </div>

        </div>


        <div className="px-4 py-4 sm:px-5 sm:py-5">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load payroll clients right now."}
            </div>
          ) : (
            <FinanceCharter
              mode="payroll"
              units={filtered}
              monthIdx={monthIdx}
              year={year}
              query={q}
              onQueryChange={setQ}
              organizationCount={summary.organizations}
              activeEmployees={summary.activeEmployees}
              windowsByUnit={windowsByUnit}
              filters={
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <FilterSelect
                      label="Client"
                      value={orgFilter}
                      onChange={setOrgFilter}
                      options={organizations.map((o) => ({
                        value: o.id,
                        label: o.code ? `${o.code} · ${o.name}` : o.name,
                      }))}
                      allLabel={`All clients (${organizations.length})`}
                    />
                    <FilterSelect
                      label="Client"
                      value={unitFilter}
                      onChange={setUnitFilter}
                      options={windowUnits.map((u) => ({
                        value: u.id,
                        label: `${u.name || u.code}${u.customer_name ? ` · ${u.customer_name}` : ""}`,
                      }))}
                      allLabel={`All units (${windowUnits.length})`}
                    />
                  </div>
                  {anyFilter && (
                    <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                      <span>
                        Filtered to <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
                         {windowUnits.length} units
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => {
                          setQ("");
                          setOrgFilter("all");
                          setUnitFilter("all");
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Clear
                      </Button>
                    </div>
                  )}
                </div>
              }
            />

          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
