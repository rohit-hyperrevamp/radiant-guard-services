import { cn } from "@/lib/utils";

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const priorityLabel = (p: string) => p[0].toUpperCase() + p.slice(1);
const CLS: Record<string, string> = {
  critical: "bg-priority-critical text-priority-critical-foreground",
  high: "bg-priority-high/15 text-priority-high",
  medium: "bg-priority-medium/15 text-priority-medium",
  low: "bg-priority-low/15 text-priority-low",
};

/** Colored priority pill: critical dark red, high red, medium amber, low green. */
export function PriorityBadge({ p }: { p: string }) {
  return <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", CLS[p] ?? CLS.medium)}>{priorityLabel(p || "medium")}</span>;
}
