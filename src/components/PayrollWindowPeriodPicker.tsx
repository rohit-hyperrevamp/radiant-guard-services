import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatPayrollPeriod,
  payrollPeriodForMonth,
  type PayrollWindowOption,
} from "@/lib/payroll-period";

export function PayrollWindowPeriodPicker({
  options,
  selectedKey,
  year,
  monthIdx,
  onWindowChange,
  onCycleChange,
}: {
  options: PayrollWindowOption[];
  selectedKey: string;
  year: number;
  monthIdx: number;
  onWindowChange: (key: string) => void;
  onCycleChange: (delta: number) => void;
}) {
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];
  const period = payrollPeriodForMonth(year, monthIdx, selected);
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[410px]">
      <Select value={selected?.key ?? ""} onValueChange={onWindowChange} disabled={!selected}>
        <SelectTrigger className="h-9 w-full rounded-xl bg-background/80 sm:w-[190px]">
          <SelectValue placeholder="Loading windows…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.label} · {option.unitCount} {option.unitCount === 1 ? "unit" : "units"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/80 p-1">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous payroll period" onClick={() => onCycleChange(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-0 flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
          {selected ? formatPayrollPeriod(period) : "No payroll windows"}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Next payroll period" onClick={() => onCycleChange(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}