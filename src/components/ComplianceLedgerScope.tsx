import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LedgerScope } from "@/lib/statutory-heads";
export function ComplianceLedgerScope({
  value,
  onChange,
}: {
  value: LedgerScope;
  onChange: (value: LedgerScope) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v === "pending" || v === "all" ? v : "posted")}
    >
      <SelectTrigger aria-label="Posting status" className="h-9 w-[190px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="posted">Posted / completed</SelectItem>
        <SelectItem value="pending">Pending / imported</SelectItem>
        <SelectItem value="all">All recorded (not cancelled)</SelectItem>
      </SelectContent>
    </Select>
  );
}
