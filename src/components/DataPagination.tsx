import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export type PaginationState<T> = {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  pageRows: T[];
};

/** Client-side pagination for any list. Defaults to 20 rows per page. */
export function usePagination<T>(rows: T[], initialPageSize = 20): PaginationState<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  const pageRows = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
    pageCount,
    total,
    start,
    end,
    pageRows,
  };
}

function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

type Props<T> = PaginationState<T> & { className?: string; label?: string };

export function DataPagination<T>({
  page,
  setPage,
  pageSize,
  setPageSize,
  pageCount,
  total,
  start,
  end,
  className,
  label = "rows",
}: Props<T>) {
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-2 border-t border-border/60 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-4",
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {start + 1}–{end} of {total} {label}
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[84px] rounded-lg text-xs sm:w-[104px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-1 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-2"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                variant={p === page ? "default" : "ghost"}
                size="sm"
                className="h-8 min-w-8 rounded-lg px-2 text-xs tabular-nums"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ),
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-2"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
