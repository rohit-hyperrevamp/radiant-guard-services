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
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selected?.key ?? ""} onValueChange={onWindowChange} disabled={!selected}>
        <SelectTrigger className="h-10 w-[220px] rounded-lg">
          <SelectValue placeholder="All payroll windows" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.label} ({option.unitCount} {option.unitCount === 1 ? "unit" : "units"})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="h-10 w-9 rounded-lg" aria-label="Previous payroll period" onClick={() => onCycleChange(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[170px] text-center text-sm font-semibold tabular-nums text-foreground">
          {selected ? formatPayrollPeriod(period) : "No payroll windows"}
        </span>
        <Button type="button" variant="outline" size="icon" className="h-10 w-9 rounded-lg" aria-label="Next payroll period" onClick={() => onCycleChange(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
