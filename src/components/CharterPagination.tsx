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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 px-2.5 py-2 sm:rounded-2xl sm:px-3">
      <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
        <span className="sm:hidden"><span className="font-semibold text-foreground tabular-nums">{from}–{to}</span> / {total.toLocaleString("en-IN")}</span>
        <span className="hidden sm:inline">Showing <span className="font-semibold text-foreground tabular-nums">{from}–{to}</span> of{" "}<span className="font-semibold text-foreground tabular-nums">{total.toLocaleString("en-IN")}</span> {noun}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-lg p-0 sm:h-8 sm:w-auto sm:gap-1 sm:rounded-xl sm:px-3"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="px-0.5 text-[11px] tabular-nums text-muted-foreground sm:px-1 sm:text-xs">
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-lg p-0 sm:h-8 sm:w-auto sm:gap-1 sm:rounded-xl sm:px-3"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
