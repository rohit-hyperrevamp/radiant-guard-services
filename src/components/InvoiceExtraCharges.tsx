import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { fmtINR } from "@/lib/payroll-calc";
import { logActivity } from "@/lib/activity-log";

/**
 * Additional invoice charges (e.g. a Technical Allowance agreed with the
 * client) that are NOT part of any designation's monthly package.
 *
 * They are pure configuration: every line is a row in `invoice_extra_charges`,
 * so any unit, any contract, any period can carry any number of them without a
 * code change. A line with a period applies to that billing cycle only; a line
 * with no period repeats every cycle for the unit.
 */

export type InvoiceExtraCharge = {
  id: string;
  unitId: string;
  contractId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  perLabel: string;
  enabled: boolean;
  sortOrder: number;
  amount: number;
};

export const INVOICE_EXTRAS_QK = "invoice-extra-charges";

type Row = Record<string, unknown>;

function mapRow(r: Row): InvoiceExtraCharge {
  const quantity = Number(r.quantity) || 0;
  const rate = Number(r.rate) || 0;
  return {
    id: String(r.id),
    unitId: String(r.unit_id),
    contractId: r.contract_id ? String(r.contract_id) : null,
    periodStart: r.period_start ? String(r.period_start) : null,
    periodEnd: r.period_end ? String(r.period_end) : null,
    description: String(r.description ?? ""),
    hsnSac: String(r.hsn_sac ?? ""),
    quantity,
    rate,
    perLabel: String(r.per_label ?? "Duty"),
    enabled: r.enabled !== false,
    sortOrder: Number(r.sort_order) || 0,
    amount: Math.round(quantity * rate * 100) / 100,
  };
}

/** Charges that apply to this unit for this billing cycle. */
export function useInvoiceExtraCharges(unitId: string, start: string, end: string) {
  return useQuery({
    queryKey: [INVOICE_EXTRAS_QK, unitId, start, end],
    enabled: Boolean(unitId && start && end),
    queryFn: async (): Promise<InvoiceExtraCharge[]> => {
      const { data, error } = await supabase
        .from("invoice_extra_charges" as never)
        .select("*")
        .eq("unit_id", unitId);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[])
        .map(mapRow)
        .filter((c) => !c.periodStart || (c.periodStart === start && c.periodEnd === end))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.description.localeCompare(b.description));
    },
  });
}

export function InvoiceExtraChargesCard({
  unitId,
  contractId,
  start,
  end,
  charges,
}: {
  unitId: string;
  contractId: string | null;
  start: string;
  end: string;
  charges: InvoiceExtraCharge[];
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ description: "", hsnSac: "998525", quantity: "1", rate: "0", perLabel: "Duty" });

  const refresh = () => qc.invalidateQueries({ queryKey: [INVOICE_EXTRAS_QK] });

  const add = useMutation({
    mutationFn: async () => {
      const payload = {
        unit_id: unitId,
        contract_id: contractId,
        period_start: start,
        period_end: end,
        description: draft.description.trim(),
        hsn_sac: draft.hsnSac.trim(),
        quantity: Number(draft.quantity) || 0,
        rate: Number(draft.rate) || 0,
        per_label: draft.perLabel.trim() || "Duty",
        sort_order: (charges.at(-1)?.sortOrder ?? 0) + 10,
      };
      if (!payload.description) throw new Error("Description is required");
      const { error } = await supabase.from("invoice_extra_charges" as never).insert(payload as never);
      if (error) throw error;
      await logActivity({
        module: "Invoice Extra Charges",
        action: "create",
        entityType: "invoice_extra_charge",
        entityLabel: `${payload.description} (${payload.quantity} × ${payload.rate})`,
      }).catch(() => {});
    },
    onSuccess: () => {
      setDraft({ description: "", hsnSac: "998525", quantity: "1", rate: "0", perLabel: "Duty" });
      refresh();
      toast.success("Charge added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add charge"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await supabase.from("invoice_extra_charges" as never).update(values as never).eq("id", id);
      if (error) throw error;
      await logActivity({ module: "Invoice Extra Charges", action: "update", entityType: "invoice_extra_charge", entityId: id, details: values }).catch(() => {});
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_extra_charges" as never).delete().eq("id", id);
      if (error) throw error;
      await logActivity({ module: "Invoice Extra Charges", action: "delete", entityType: "invoice_extra_charge", entityId: id }).catch(() => {});
    },
    onSuccess: () => {
      refresh();
      toast.success("Charge removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const total = charges.reduce((s, c) => s + (c.enabled ? c.amount : 0), 0);

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Additional charges</h3>
          <p className="text-xs text-muted-foreground">
            Agreed charges billed on top of the designation lines — configured per unit and period, nothing fixed in code.
          </p>
        </div>
        <div className="text-sm font-semibold tabular-nums text-emerald-700">{fmtINR(total)}</div>
      </div>

      <div className="mt-4 space-y-2">
        {charges.map((c) => (
          <div key={c.id} className="grid grid-cols-1 items-center gap-2 md:grid-cols-12">
            <Input
              className="md:col-span-4"
              defaultValue={c.description}
              onBlur={(e) => e.target.value !== c.description && patch.mutate({ id: c.id, values: { description: e.target.value } })}
            />
            <Input
              className="md:col-span-2"
              defaultValue={c.hsnSac}
              placeholder="HSN/SAC"
              onBlur={(e) => e.target.value !== c.hsnSac && patch.mutate({ id: c.id, values: { hsn_sac: e.target.value } })}
            />
            <Input
              className="md:col-span-1 text-right"
              defaultValue={String(c.quantity)}
              inputMode="decimal"
              onBlur={(e) => Number(e.target.value) !== c.quantity && patch.mutate({ id: c.id, values: { quantity: Number(e.target.value) || 0 } })}
            />
            <Input
              className="md:col-span-1"
              defaultValue={c.perLabel}
              onBlur={(e) => e.target.value !== c.perLabel && patch.mutate({ id: c.id, values: { per_label: e.target.value } })}
            />
            <Input
              className="md:col-span-2 text-right"
              defaultValue={String(c.rate)}
              inputMode="decimal"
              onBlur={(e) => Number(e.target.value) !== c.rate && patch.mutate({ id: c.id, values: { rate: Number(e.target.value) || 0 } })}
            />
            <div className="flex items-center justify-end gap-3 md:col-span-2">
              <span className="text-sm font-semibold tabular-nums">{fmtINR(c.amount)}</span>
              <Switch checked={c.enabled} onCheckedChange={(v) => patch.mutate({ id: c.id, values: { enabled: v } })} />
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {charges.length === 0 && (
          <p className="text-xs text-muted-foreground">No additional charges for this period.</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 items-center gap-2 border-t border-border/60 pt-4 md:grid-cols-12">
        <Input
          className="md:col-span-4"
          placeholder="Description (e.g. Technical Allowance)"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <Input className="md:col-span-2" placeholder="HSN/SAC" value={draft.hsnSac} onChange={(e) => setDraft({ ...draft, hsnSac: e.target.value })} />
        <Input className="md:col-span-1 text-right" placeholder="Qty" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
        <Input className="md:col-span-1" placeholder="Per" value={draft.perLabel} onChange={(e) => setDraft({ ...draft, perLabel: e.target.value })} />
        <Input className="md:col-span-2 text-right" placeholder="Rate" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} />
        <div className="md:col-span-2 flex justify-end">
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
            <Plus className="mr-1.5 h-4 w-4" /> Add charge
          </Button>
        </div>
      </div>
    </div>
  );
}
