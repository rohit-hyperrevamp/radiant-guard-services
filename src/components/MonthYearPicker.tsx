import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Standard month picker used across compliance / payroll style registers.
 * Value is an ISO year-month string, e.g. "2026-08".
 */
export function MonthYearPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (ym: string) => void;
  className?: string;
}) {
  const [yStr, mStr] = value.split("-");
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  if (!years.includes(year)) years.push(year);
  years.sort((a, b) => a - b);

  const emit = (y: number, m: number) => {
    const d = new Date(y, m, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div
      className={cn(
        "grid h-10 w-[218px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-0.5 rounded-lg border border-input bg-card px-1 shadow-sm sm:inline-flex sm:w-auto sm:gap-1 sm:px-1.5",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => emit(year, monthIdx - 1)}
        className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <CalendarDays className="ml-0.5 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />

      <Select value={String(monthIdx)} onValueChange={(v) => emit(year, Number(v))}>
        <SelectTrigger className="h-8 min-w-0 rounded-md border-0 bg-transparent px-1.5 text-sm font-semibold shadow-none hover:bg-muted focus:ring-0 sm:w-[124px] sm:px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((m, i) => (
            <SelectItem key={m} value={String(i)} className="text-[12px]">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-5 w-px bg-border/70" />

      <Select value={String(year)} onValueChange={(v) => emit(Number(v), monthIdx)}>
        <SelectTrigger className="h-8 w-[66px] rounded-md border-0 bg-transparent px-1.5 text-sm font-semibold tabular-nums shadow-none hover:bg-muted focus:ring-0 sm:w-[86px] sm:px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)} className="text-[12px] tabular-nums">
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        aria-label="Next month"
        onClick={() => emit(year, monthIdx + 1)}
        className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
