import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildInvoiceNumber,
  fiscalYearLabel,
  monthCode,
  useInvoiceNumberSeries,
  useInvoiceNumberTokens,
} from "@/lib/invoice-numbering";
import { FINAL_INVOICE_QK, generateFinalInvoice } from "@/lib/final-invoice";
import { fmtMoney } from "@/lib/contract-finance";
import { logActivity } from "@/lib/activity-log";

// ---------------------------------------------------------------------------
// Generate final invoice — the only place an invoice number is consumed.
// Selected sites are grouped per client + billing state (the number series is
// state-driven); each group takes exactly one number on the chosen date.
// ---------------------------------------------------------------------------

export type FinalInvoiceTarget = {
  unitId: string;
  unitLabel: string;
  customerId: string | null;
  customerName: string;
  billingState: string | null;
  periodStart: string;
  periodEnd: string;
  taxableValue: number;
};

type Group = {
  key: string;
  customerId: string | null;
  customerName: string;
  billingState: string | null;
  periodStart: string;
  periodEnd: string;
  targets: FinalInvoiceTarget[];
  taxableValue: number;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function FinalInvoiceDialog({
  open,
  onOpenChange,
  targets,
  onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  targets: FinalInvoiceTarget[];
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setTokens({});
    }
  }, [open]);

  const dateObj = useMemo(() => {
    const d = new Date(`${invoiceDate}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [invoiceDate]);
  const fy = fiscalYearLabel(dateObj);
  const mc = monthCode(dateObj);

  const seriesQ = useInvoiceNumberSeries(fy);
  const tokensQ = useInvoiceNumberTokens();

  const resolveSeries = (state: string | null) => {
    const list = (seriesQ.data ?? []).filter((s) => s.enabled);
    return list.find((s) => norm(s.state_name) === norm(state)) ?? list.find((s) => s.state_code === "MH") ?? null;
  };

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const t of targets) {
      const key = `${t.customerId ?? t.customerName}|${norm(t.billingState)}|${t.periodStart}|${t.periodEnd}`;
      const g = map.get(key) ?? {
        key,
        customerId: t.customerId,
        customerName: t.customerName,
        billingState: t.billingState,
        periodStart: t.periodStart,
        periodEnd: t.periodEnd,
        targets: [],
        taxableValue: 0,
      };
      g.targets.push(t);
      g.taxableValue += t.taxableValue;
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [targets]);

  const submit = async () => {
    setBusy(true);
    const issued: string[] = [];
    try {
      for (const g of groups) {
        const series = resolveSeries(g.billingState);
        if (!series) throw new Error(`No invoice number series set up for ${g.billingState ?? "this state"}`);
        const taxable = Math.round(g.taxableValue * 100) / 100;
        const tax = Math.round(taxable * 0.18 * 100) / 100;
        const result = await generateFinalInvoice({
          unitIds: g.targets.map((t) => t.unitId),
          periodStart: g.periodStart,
          periodEnd: g.periodEnd,
          invoiceDate,
          billingState: g.billingState,
          clientToken: tokens[g.key] || null,
          customerId: g.customerId,
          partyName: g.customerName,
          taxableValue: taxable,
          taxTotal: tax,
          totalValue: Math.round((taxable + tax) * 100) / 100,
        });
        issued.push(result.invoice_no);
        void logActivity({
          module: "Invoicing",
          action: "create",
          entityType: "final_invoice",
          entityId: result.final_invoice_id,
          entityLabel: result.invoice_no,
          details: {
            party: g.customerName,
            state: g.billingState,
            units: g.targets.map((t) => t.unitLabel),
            period: `${g.periodStart} to ${g.periodEnd}`,
            invoice_date: invoiceDate,
          },
        });
      }
      await qc.invalidateQueries({ queryKey: [FINAL_INVOICE_QK] });
      await qc.invalidateQueries({ queryKey: ["invoice-number-series"] });
      await qc.invalidateQueries({ queryKey: ["invoice-number-registry"] });
      toast.success(
        issued.length === 1 ? `Final invoice ${issued[0]} generated` : `${issued.length} final invoices generated`,
      );
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the final invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" /> Generate final invoice
          </DialogTitle>
          <DialogDescription>
            An invoice number is taken from the billing state's series for the invoice date. Once issued it can never be
            released or reused.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5 sm:max-w-[220px]">
            <Label htmlFor="final-invoice-date">Invoice date</Label>
            <Input
              id="final-invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="h-10 rounded-xl"
            />
            <span className="text-[11px] text-muted-foreground">Series month {mc}{fy}</span>
          </div>

          <div className="space-y-2">
            {groups.map((g) => {
              const series = resolveSeries(g.billingState);
              const stateTokens = (tokensQ.data ?? []).filter(
                (t) => t.enabled && t.state_code === series?.state_code,
              );
              const preview = series
                ? buildInvoiceNumber({
                    prefix: series.number_prefix,
                    monthCode: mc,
                    fiscalYear: fy,
                    token: tokens[g.key] || null,
                    sequence: series.last_sequence + 1,
                    padding: series.seq_padding,
                  })
                : "—";
              return (
                <div key={g.key} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{g.customerName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {g.billingState ?? "State not set"} · {g.targets.length} site
                        {g.targets.length > 1 ? "s" : ""} · {g.periodStart} to {g.periodEnd}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Taxable</div>
                      <div className="text-sm font-semibold tabular-nums">{fmtMoney(g.taxableValue)}</div>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)] sm:items-center">
                    <Select
                      value={tokens[g.key] || "none"}
                      onValueChange={(v) => setTokens((p) => ({ ...p, [g.key]: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="h-9 rounded-lg" aria-label="Client code">
                        <SelectValue placeholder="No client code" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No client code</SelectItem>
                        {stateTokens.map((t) => (
                          <SelectItem key={t.id} value={t.token}>
                            {t.token}
                            {t.sample_party_name ? ` · ${t.sample_party_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="truncate rounded-lg border border-dashed border-primary/40 bg-background px-3 py-1.5 text-sm font-semibold tabular-nums">
                      {preview}
                    </div>
                  </div>

                  <div className="mt-2 truncate text-[11px] text-muted-foreground">
                    {g.targets.map((t) => t.unitLabel).join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || groups.length === 0 || seriesQ.isLoading}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            {busy ? "Generating…" : `Generate ${groups.length > 1 ? `${groups.length} invoices` : "invoice"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
