import { financeProfit, financeLossReason, financeSummaryAmount } from "@/lib/finance-totals";
import { matchesSearch } from "@/lib/search-match";
import { TileNumber } from "@/components/TileNumber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  PiggyBank,
  Receipt,
  Search,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LabeledMultiSelectFilter } from "@/components/MultiSelectFilter";
import { downloadCsv } from "@/lib/csv-export";
import { fmtINR } from "@/lib/payroll-calc";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Committed vs actual (MTD) money charters — payroll, invoice and P&L.
// Mirrors the deployment (workforce) charter format exactly: four headline
// tiles (committed / actual / variance / coverage) plus a drill-down dialog
// listing every unit.
// ---------------------------------------------------------------------------
//
// Both lists page through their rows: with several hundred client units,
// rendering every row at once was the slowest part of painting the dashboard.

import { Pager, usePaged } from "@/components/Pager";

// ---------------------------------------------------------------------------

export type UnitFinanceRow = {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  customer_name: string;
  customer_id?: string;
  billing_state?: string | null;
  client_state?: string | null;
  billing_city?: string | null;
  internal: boolean;
  committed_strength: number;
  actual_strength: number;
  committed_payroll: number;
  actual_payroll: number;
  actual_employer_contribution: number;
  /** Commercial fee tracked separately; already included in invoice revenue. */
  actual_management_fee?: number;
  committed_invoice: number;
  actual_invoice: number;
  /** Attendance still open for the window — invoice/payroll not ready. */
  attendance_open?: boolean;
  totals_pending?: boolean;
  totals_error?: boolean;
};

/**
 * Site profit: invoice − earned gross − actual employer costs.
 * Commercial fees and reliever charges are already in invoice revenue.
 */
export function unitProfit(r: Pick<UnitFinanceRow, "actual_invoice" | "actual_payroll" | "actual_employer_contribution" | "actual_management_fee">): number {
  return financeProfit({ invoice: r.actual_invoice, gross: r.actual_payroll, employer: r.actual_employer_contribution });
}

export type Tone = "success" | "ok" | "warning" | "destructive";

/**
 * Completion tone — actual earned value against the full-month commitment.
 * No calendar-day extrapolation is used: OT and payroll-day bases make that
 * comparison misleading, especially at the start of a month.
 */
export function completionTone(committed: number, actual: number): Tone {
  if (committed <= 0) return "ok";
  const completion = (actual / committed) * 100;
  if (completion >= 98) return "success";
  if (completion >= 85) return "warning";
  return "destructive";
}

/** Shortfall tone for money: under-delivery beyond 5% is red, up to 5% amber. */
function moneyTone(committed: number, actual: number): "ok" | "warning" | "destructive" {
  if (committed <= 0) return "ok";
  if (actual >= committed) return "ok";
  const deltaPct = ((committed - actual) / committed) * 100;
  return deltaPct > 5 ? "destructive" : "warning";
}

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
  pressed,
  actionLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Users;
  tone?: "accent" | "success" | "warning" | "destructive";
  /** Makes the whole tile a button (e.g. to sort the list below by this figure). */
  onClick?: () => void;
  pressed?: boolean;
  actionLabel?: string;
}) {
  const Root = onClick ? "button" : "div";
  return (
    <Root
      {...(onClick
        ? {
            type: "button" as const,
            onClick,
            "aria-pressed": pressed,
            "aria-label": actionLabel,
            title: actionLabel,
            "data-panel": true,
          }
        : {})}
      className={cn(
        "dashboard-summary-tile flex min-w-0 flex-col rounded-2xl border p-3 bg-gradient-to-br",
        onClick &&
          "cursor-pointer text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed && "ring-2 ring-emerald-500/50",
        tone === "success"
          ? "border-emerald-500/40 from-emerald-500/15 to-emerald-500/5"
          : tone === "warning"
            ? "border-amber-500/40 from-amber-500/15 to-amber-500/5"
            : tone === "destructive"
              ? "border-destructive/40 from-destructive/15 to-destructive/5"
              : tone === "accent"
                ? "border-primary/30 from-primary/10 to-primary/5"
                : "border-border from-background/80 to-background/40",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "accent" && "text-primary",
            tone === "success" && "text-emerald-600",
            tone === "warning" && "text-amber-500",
            tone === "destructive" && "text-destructive",
          )}
        />
        <TileNumber variant="label" className="dashboard-tile-title">
          {label}
        </TileNumber>
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      <TileNumber
        className={cn(
          "mt-auto min-w-0 text-base font-semibold tabular-nums xl:text-lg",
          tone === "success" && "text-emerald-600",
          tone === "warning" && "text-amber-600",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </TileNumber>
    </Root>
  );
}

function VarianceChip({ diff, money }: { diff: number; money?: boolean }) {
  const tone =
    diff >= 0
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
      : "bg-destructive/10 text-destructive border-destructive/25";
  const text = money
    ? `${diff >= 0 ? "+" : "−"}${fmtINR(Math.abs(diff))}`
    : `${diff > 0 ? "+" : ""}${diff}`;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone,
      )}
    >
      {text}
    </span>
  );
}

type Money = { committed: number; actual: number };

function summaryMoney(value: number, readyCount: number): string {
  const amount = financeSummaryAmount(value, readyCount);
  return amount === null ? "—" : fmtINR(amount);
}

function CoverageCard({
  eyebrow,
  title,
  description,
  rows,
  pick,
  buttonLabel,
  labels,
  icons,
  strengthOf,
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows: UnitFinanceRow[];
  pick: (r: UnitFinanceRow) => Money;
  buttonLabel: string;
  labels: { committed: string; actual: string };
  icons: { committed: typeof Users; actual: typeof Users };
  strengthOf?: (r: UnitFinanceRow) => { committed: number; actual: number };
}) {
  const [open, setOpen] = useState(false);

  const totals = useMemo(() => {
    const ready = rows.filter(r => !r.totals_pending);
    const committed = ready.reduce((s, r) => s + pick(r).committed, 0);
    const actual = ready.reduce((s, r) => s + pick(r).actual, 0);
    const strength = rows.reduce(
      (s, r) => {
        const st = strengthOf?.(r) ?? { committed: 0, actual: 0 };
        return { committed: s.committed + st.committed, actual: s.actual + st.actual };
      },
      { committed: 0, actual: 0 },
    );
    return {
      ready: ready.length,
      committed,
      actual,
      remaining: committed - actual,
      coverage: committed > 0 ? Math.round((actual / committed) * 100) : 0,
      tone: completionTone(committed, actual),
      strength,
    };
  }, [rows, pick, strengthOf]);

  const toneTile = totals.tone === "ok" ? undefined : totals.tone;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" className="h-9 rounded-lg" onClick={() => setOpen(true)}>
          {buttonLabel}
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={labels.committed}
          value={summaryMoney(totals.committed, totals.ready)}
          sub={
            strengthOf
              ? `${totals.strength.committed} committed strength · full month`
              : "Full month"
          }
          icon={icons.committed}
          tone="accent"
        />
        <Tile
          label={labels.actual}
          value={summaryMoney(totals.actual, totals.ready)}
          sub={`${rows.length} clients · ${rows.filter(r => r.totals_pending).length} pending`}
          icon={icons.actual}
          tone={toneTile}
        />
        <Tile
          label="Remaining to full month"
          value={totals.ready > 0 ? `${totals.remaining < 0 ? "+" : ""}${fmtINR(Math.abs(Math.round(totals.remaining)))}` : "—"}
          sub={totals.ready === 0 ? "Awaiting updated totals" : totals.remaining >= 0 ? "Contract value not yet earned" : "Earned above commitment"}
          icon={TrendingDown}
          tone={toneTile}
        />
        <Tile
          label="MTD completion"
          value={totals.ready > 0 ? `${totals.coverage}%` : "—"}
          sub="Actual ÷ full-month committed"
          icon={Gauge}
          tone={toneTile}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Actual MTD is calculated from attendance duties and each contract resource&apos;s
        payroll-day base. Completion is actual divided by the full-month commitment; no calendar-day
        projection or static target is applied.
      </p>

      <CharterDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        rows={rows}
        pick={pick}
        labels={labels}
        strengthOf={strengthOf}
      />
    </div>
  );
}

function CharterDialog({
  open,
  onOpenChange,
  title,
  description,
  rows,
  pick,
  labels,
  strengthOf,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  rows: UnitFinanceRow[];
  pick: (r: UnitFinanceRow) => Money;
  labels: { committed: string; actual: string };
  strengthOf?: (r: UnitFinanceRow) => { committed: number; actual: number };
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      matchesSearch(q, [r.unit_name, r.customer_name, r.unit_code]),
    );
  }, [query, rows]);

  const paged = usePaged(filtered, `${query}|${rows.length}`);

  const totals = useMemo(() => {
    const ready = filtered.filter((r) => !r.totals_pending);
    return {
      ready: ready.length,
      committed: ready.reduce((s, r) => s + pick(r).committed, 0),
      actual: ready.reduce((s, r) => s + pick(r).actual, 0),
    };
  }, [filtered, pick]);

  const exportCsv = () => {
    downloadCsv(
      title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      filtered.map((r) => ({
        Unit: r.unit_name,
        Code: r.unit_code,
        Organisation: r.customer_name,
        [labels.committed]: r.totals_pending ? "Pending" : pick(r).committed.toFixed(2),
        [labels.actual]: r.totals_pending ? "Pending" : pick(r).actual.toFixed(2),
        Variance: r.totals_pending ? "Pending" : (pick(r).actual - pick(r).committed).toFixed(2),
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-3 pt-3 sm:px-5 sm:pt-4">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-9 rounded-lg pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {summaryMoney(totals.committed, totals.ready)}
            </span>{" "}
            committed ·{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {summaryMoney(totals.actual, totals.ready)}
            </span>{" "}
            actual
          </div>
          <Button variant="outline" className="h-9 rounded-lg" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5 pt-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No units match this search.
            </div>
          ) : (
            <div className="space-y-2">
              {paged.pageRows.map((r) => {
                const m = pick(r);
                const isOpen = !!expanded[r.unit_id];
                const st = strengthOf?.(r);
                return (
                  <div
                    key={r.unit_id}
                    className="overflow-hidden rounded-xl border border-border bg-background/50"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [r.unit_id]: !p[r.unit_id] }))}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{r.unit_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.customer_name} · {r.unit_code}
                          {r.internal ? " · Internal" : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Committed
                          </div>
                          <div className="whitespace-nowrap font-semibold">
                            {r.totals_pending ? "—" : fmtINR(m.committed)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Actual MTD
                          </div>
                          <div
                            className={cn(
                              "whitespace-nowrap font-semibold",
                              moneyTone(m.committed, m.actual) === "destructive" &&
                                "text-destructive",
                              moneyTone(m.committed, m.actual) === "warning" && "text-amber-600",
                            )}
                          >
                            {r.totals_pending ? (r.totals_error ? "Source unavailable" : "Pending") : fmtINR(m.actual)}
                          </div>
                        </div>
                        {!r.totals_pending && <VarianceChip diff={m.actual - m.committed} money />}
                      </div>
                    </button>

                    {isOpen && !r.totals_pending && (
                      <div className="grid gap-2 border-t border-border bg-muted/30 px-3 py-2 text-xs sm:grid-cols-3">
                        {st && (
                          <div>
                            <div className="text-muted-foreground">Strength</div>
                            <div className="font-semibold tabular-nums">
                              {st.actual} / {st.committed}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-muted-foreground">Coverage</div>
                          <div className="font-semibold tabular-nums">
                            {m.committed > 0 ? Math.round((m.actual / m.committed) * 100) : 0}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Variance</div>
                          <div className="font-semibold tabular-nums">
                            {fmtINR(m.actual - m.committed)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Pager
            page={paged.page}
            pageCount={paged.pageCount}
            from={paged.from}
            to={paged.to}
            total={paged.total}
            onPage={paged.setPage}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Payroll committed vs actual (MTD). */
export function PayrollCoverageCard({ rows }: { rows: UnitFinanceRow[] }) {
  // Compare like-for-like with invoice: customer-billable units only.
  // Internal payroll belongs in overhead reporting, not this coverage charter.
  const billable = rows.filter((r) => !r.internal);
  return (
    <CoverageCard
      eyebrow="Payroll"
      title="Committed vs Actual Payroll"
      description="Full-month contracted payroll cost across active contracts against payroll actually earned month-till-date."
      rows={billable}
      pick={(r) => ({ committed: r.committed_payroll, actual: r.actual_payroll })}
      buttonLabel="View full payroll charter"
      labels={{ committed: "Committed payroll", actual: "Actual payroll MTD" }}
      icons={{ committed: Wallet, actual: Banknote }}
      strengthOf={(r) => ({ committed: r.committed_strength, actual: r.actual_strength })}
    />
  );
}

/** Invoice committed vs actual (MTD). */
export function InvoiceCoverageCard({ rows }: { rows: UnitFinanceRow[] }) {
  const billable = rows.filter((r) => !r.internal);
  return (
    <CoverageCard
      eyebrow="Invoice"
      title="Committed vs Actual Invoice"
      description="Contracted billable value across active client contracts against invoice value earned month-till-date."
      rows={billable}
      pick={(r) => ({ committed: r.committed_invoice, actual: r.actual_invoice })}
      buttonLabel="View full invoice charter"
      labels={{ committed: "Committed invoice", actual: "Actual invoice MTD" }}
      icons={{ committed: Receipt, actual: Banknote }}
      strengthOf={(r) => ({ committed: r.committed_strength, actual: r.actual_strength })}
    />
  );
}

/** Unit-wise P&L from live attendance: invoice, earned gross, employer cost and profitability. */
export function ProfitabilityCard({ rows: allRows }: { rows: UnitFinanceRow[] }) {
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  // null = default order (highest profitability first). Clicking Margin sorts
  // by margin, highest first, and each further click flips max ↔ min.
  const [marginSort, setMarginSort] = useState<"desc" | "asc" | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const toggleMarginSort = (scroll: boolean) => {
    setMarginSort((s) => (s === "desc" ? "asc" : "desc"));
    if (scroll) tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Internal / non-billable units carry cost with no customer revenue by
  // design — including them would make P&L negative by construction.
  const rows = useMemo(() => allRows.filter((r) => !r.internal), [allRows]);

  const orgOptions = useMemo(
    () =>
      Array.from(
        new Map(
          rows.map((r) => [
            r.customer_id || r.customer_name,
            { value: r.customer_id || r.customer_name, label: r.customer_name },
          ]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [rows],
  );
  // States cascade from the selected organizations — picking an org narrows
  // the state list to only the states that org actually operates in.
  const orgScopedRows = useMemo(
    () =>
      orgFilter.length === 0
        ? rows
        : rows.filter((r) => !r.internal && orgFilter.includes(r.customer_id || r.customer_name)),
    [rows, orgFilter],
  );
  const stateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          orgScopedRows
            .map((r) => r.client_state || r.billing_state)
            .filter((s): s is string => !!s),
        ),
      )
        .sort()
        .map((s) => ({ value: s, label: s })),
    [orgScopedRows],
  );

  const scopedRows = useMemo(
    () =>
      orgScopedRows.filter((r) => {
        if (
          stateFilter.length > 0 &&
          !(
            (r.client_state || r.billing_state) &&
            stateFilter.includes((r.client_state || r.billing_state) as string)
          )
        )
          return false;
        return true;
      }),
    [orgScopedRows, stateFilter],
  );

  const totals = useMemo(() => {
    const ready = scopedRows.filter((r) => !r.totals_pending);
    const invoice = ready.reduce((s, r) => s + r.actual_invoice, 0);
    const earnedGross = ready.reduce((s, r) => s + r.actual_payroll, 0);
    const employerContribution = ready.reduce((s, r) => s + r.actual_employer_contribution, 0);
    const profit = ready.reduce((sum, r) => sum + unitProfit(r), 0);
    return {
      invoice,
      earnedGross,
      employerContribution,
      profit,
      margin: invoice > 0 ? (profit / invoice) * 100 : 0,
      ready: ready.length,
      open: scopedRows.length - ready.length,
    };
  }, [scopedRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? scopedRows.filter((r) => matchesSearch(q, [r.unit_name, r.customer_name, r.unit_code]))
      : scopedRows;
    // Same margin the row displays (0 when there is no invoice).
    const marginOf = (r: UnitFinanceRow) =>
      r.actual_invoice > 0 ? (unitProfit(r) / r.actual_invoice) * 100 : 0;
    const val = (r: UnitFinanceRow) => (marginSort ? marginOf(r) : unitProfit(r));
    const dir = marginSort === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      // Rows awaiting totals have no figures yet: always keep them last.
      if (a.totals_pending !== b.totals_pending) return a.totals_pending ? 1 : -1;
      if (a.totals_pending) return 0;
      return dir * (val(a) - val(b)) || unitProfit(b) - unitProfit(a);
    });
  }, [scopedRows, query, marginSort]);

  const paged = usePaged(
    filtered,
    `${query}|${orgFilter.join(",")}|${stateFilter.join(",")}|${rows.length}|${marginSort ?? ""}`,
  );
  const marginSortLabel =
    marginSort === "desc"
      ? "Sorted by margin, highest first. Click to show lowest first."
      : marginSort === "asc"
        ? "Sorted by margin, lowest first. Click to show highest first."
        : "Sort clients by margin, highest first";

  const exportCsv = () =>
    downloadCsv(
      "unit-profitability",
      filtered.map((r) => ({
        Unit: r.unit_name,
        "Client ID": r.unit_code,
        Organisation: r.customer_name,
        Invoice: r.totals_pending ? "Pending" : r.actual_invoice.toFixed(2),
        "Earned Gross": r.totals_pending ? "Pending" : r.actual_payroll.toFixed(2),
        "Employer Contribution": r.totals_pending
          ? "Pending"
          : r.actual_employer_contribution.toFixed(2),
        Profitability: r.totals_pending
          ? "Pending"
          : unitProfit(r).toFixed(2),
        Margin:
          r.totals_pending || r.actual_invoice <= 0
            ? "—"
            : `${(((unitProfit(r)) / r.actual_invoice) * 100).toFixed(1)}%`,
        Status: r.totals_pending ? "Awaiting updated totals" : "Included",
      })),
    );

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            P&amp;L
          </div>
          <h2 className="text-base font-semibold">Client Profitability</h2>
          <p className="text-xs text-muted-foreground">
            {scopedRows.length} clients · {totals.ready} ready · {totals.open} awaiting updated totals
          </p>
        </div>
        <Button variant="outline" className="h-9 rounded-lg" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Tile
          label="Invoice"
          value={summaryMoney(totals.invoice, totals.ready)}
          sub={`${totals.ready} site${totals.ready === 1 ? "" : "s"} ready`}
          icon={Receipt}
          tone="accent"
        />
        <Tile
          label="Earned gross"
          value={summaryMoney(totals.earnedGross, totals.ready)}
          sub="Gross earned from attendance"
          icon={Wallet}
          tone="accent"
        />
        <Tile
          label="Employer contribution"
          value={summaryMoney(totals.employerContribution, totals.ready)}
          sub="Employer-side cost"
          icon={Banknote}
          tone="accent"
        />
        <Tile
          label="Profitability"
          value={summaryMoney(totals.profit, totals.ready)}
          sub={totals.ready > 0 ? `${totals.margin.toFixed(1)}% margin` : "Awaiting updated totals"}
          icon={PiggyBank}
          tone={totals.profit < 0 ? "destructive" : "success"}
        />
        <Tile
          label="Margin"
          value={totals.ready > 0 ? `${totals.margin.toFixed(1)}%` : "—"}
          sub={
            marginSort === "desc"
              ? "List: highest margin first · tap for lowest"
              : marginSort === "asc"
                ? "List: lowest margin first · tap for highest"
                : `${totals.open} client${totals.open === 1 ? "" : "s"} awaiting totals · tap to sort`
          }
          icon={Gauge}
          tone={totals.margin < 0 ? "destructive" : "success"}
          onClick={() => toggleMarginSort(true)}
          pressed={marginSort !== null}
          actionLabel={marginSortLabel}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LabeledMultiSelectFilter
          label="Organization"
          selected={orgFilter}
          onChange={(v) => {
            setOrgFilter(v);
            // Drop selected states the newly chosen orgs don't operate in.
            setStateFilter((prev) =>
              prev.filter((s) =>
                rows.some(
                  (r) =>
                    (r.client_state || r.billing_state) === s &&
                    (v.length === 0 || v.includes(r.customer_id || r.customer_name)),
                ),
              ),
            );
          }}
          options={orgOptions}
          allLabel={`All organizations (${orgOptions.length})`}
        />
        <LabeledMultiSelectFilter
          label="State"
          selected={stateFilter}
          onChange={setStateFilter}
          options={stateOptions}
          allLabel={`All states (${stateOptions.length})`}
        />
      </div>

      <div className="relative mt-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client or organisation…"
          className="h-9 rounded-lg pl-9"
        />
      </div>

      <div
        ref={tableRef}
        className="mt-3 scroll-mt-4 overflow-x-auto rounded-xl border border-border"
      >
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Client</th>
              <th className="px-3 py-2 text-right font-semibold">Invoice</th>
              <th className="px-3 py-2 text-right font-semibold">Earned Gross</th>
              <th className="px-3 py-2 text-right font-semibold">Employer Contribution</th>
              <th className="px-3 py-2 text-right font-semibold">Profitability</th>
              <th
                className="px-3 py-2 text-right font-semibold"
                aria-sort={
                  marginSort === "desc" ? "descending" : marginSort === "asc" ? "ascending" : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => toggleMarginSort(false)}
                  title={marginSortLabel}
                  aria-label={marginSortLabel}
                  className={cn(
                    "inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    marginSort && "text-foreground",
                  )}
                >
                  Margin
                  {marginSort === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                  ) : marginSort === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No units to report for this cycle.
                </td>
              </tr>
            )}
            {paged.pageRows.map((r) => {
              const profit = unitProfit(r);
              const margin = r.actual_invoice > 0 ? (profit / r.actual_invoice) * 100 : 0;
              if (r.totals_pending) {
                return (
                  <tr key={r.unit_id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.unit_name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.unit_code} · {r.customer_name}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">—</td>
                    <td colSpan={2} className="px-3 py-2 text-right">
                      <span className="text-xs font-medium text-muted-foreground">
                        {r.totals_error ? "Source unavailable · not in totals" : "Awaiting updated totals"}
                      </span>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={r.unit_id} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.unit_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.unit_code} · {r.customer_name}
                      {r.internal ? " · Internal" : ""}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {fmtINR(r.actual_invoice)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {fmtINR(r.actual_payroll)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {fmtINR(r.actual_employer_contribution)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums",
                      profit < 0 ? "text-destructive" : "text-emerald-600",
                    )}
                  >
                    {fmtINR(profit)}
                    {profit < 0 && <div className="mt-1 max-w-72 whitespace-normal text-xs font-normal text-destructive">{financeLossReason({ invoice: r.actual_invoice, gross: r.actual_payroll, employer: r.actual_employer_contribution })}</div>}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      margin < 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {margin.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager
          page={paged.page}
          pageCount={paged.pageCount}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          onPage={paged.setPage}
        />
      </div>
    </div>
  );
}
