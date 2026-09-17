import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared pager for the charter lists. Keeps the "x–y of n" wording identical
 * across attendance, payroll and invoicing so paging reads the same everywhere.
 */
export function CharterPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  noun = "units",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (next: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-secondary/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground tabular-nums">{from}–{to}</span> of{" "}
        <span className="font-semibold text-foreground tabular-nums">{total.toLocaleString("en-IN")}</span> {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-xl text-xs"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <span className="px-1 text-xs tabular-nums text-muted-foreground">
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-xl text-xs"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
