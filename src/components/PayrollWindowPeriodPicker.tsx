import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type PayrollWindowOption } from "@/lib/payroll-period";

export function PayrollWindowPeriodPicker({
  options,
  selectedKey,
  onWindowChange,
}: {
  options: PayrollWindowOption[];
  selectedKey: string;
  onWindowChange: (key: string) => void;
}) {
  return (
    <Select value={selectedKey || "all"} onValueChange={onWindowChange}>
      <SelectTrigger className="h-10 min-w-0 flex-1 rounded-xl sm:w-[220px] sm:flex-none">
        <SelectValue placeholder="All payroll windows" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All payroll windows</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.key} value={option.key}>
            {option.label} ({option.windowStartDay}–{option.windowEndDay})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
