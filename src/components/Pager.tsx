import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Long dashboard lists page instead of painting every row: with several
// thousand units, rendering the whole list was the slowest part of the screen.

export const PAGE_SIZE = 25;

/** Rows for the current page plus the paging controls. */
export function usePaged<T>(rows: T[], resetKey: unknown) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => setPage(0), [resetKey]);
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  return {
    pageRows: rows.slice(start, start + PAGE_SIZE),
    page: current,
    pageCount,
    setPage,
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(start + PAGE_SIZE, rows.length),
    total: rows.length,
  };
}

export function Pager({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
      <div className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="h-8 rounded-lg px-2"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xs text-muted-foreground tabular-nums">
          {page + 1} / {pageCount}
        </div>
        <Button
          variant="outline"
          className="h-8 rounded-lg px-2"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
