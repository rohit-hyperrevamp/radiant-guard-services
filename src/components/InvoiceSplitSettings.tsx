import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import {
  DEFAULT_SPLIT,
  EXCLUDE,
  INVOICE_ITEMS,
  loadContractInvoiceSplit,
  type InvoiceSplit,
} from "@/lib/invoice-split";

/** Contract-level rules for what goes into which invoice (or is left out). */
export function InvoiceSplitSettings({ contractId, contractCode, canEdit }: { contractId: string; contractCode: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["contract-invoice-split", contractId],
    queryFn: () => loadContractInvoiceSplit(contractId),
  });
  const [draft, setDraft] = useState<InvoiceSplit>(DEFAULT_SPLIT);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const addPart = () => {
    const n = draft.parts.length + 1;
    let key = `part${n}`;
    while (draft.parts.some((p) => p.key === key)) key = `${key}x`;
    setDraft({ ...draft, parts: [...draft.parts, { key, label: `Invoice ${n}` }] });
  };
  const removePart = (key: string) => {
    const parts = draft.parts.filter((p) => p.key !== key);
    const first = parts[0].key;
    const assign = { ...draft.assign };
    for (const it of INVOICE_ITEMS) if (assign[it.key] === key) assign[it.key] = first;
    setDraft({ parts, assign });
  };

  const save = async () => {
    if (draft.parts.some((p) => !p.label.trim())) return toast.error("Give every invoice a name");
    setSaving(true);
    const value = draft.parts.length === 1 && INVOICE_ITEMS.every((it) => draft.assign[it.key] !== EXCLUDE) ? null : draft;
    const { error } = await supabase
      .from("client_contracts")
      .update({ invoice_split: value } as never)
      .eq("id", contractId);
    setSaving(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["contract-invoice-split", contractId] });
    void logActivity({
      module: "Client Contracts",
      action: "update",
      entityType: "client_contracts",
      entityId: contractId,
      entityLabel: contractCode,
      details: { invoice_split: value },
    });
    toast.success("Invoice output rules saved");
  };

  if (isLoading) return <div className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading invoice rules…</div>;

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoice output</div>
          <div className="text-xs text-muted-foreground">
            Choose what each invoice includes. Each invoice gets its own number when finalised.
          </div>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={addPart}>
            <Plus className="mr-1 h-4 w-4" /> Add invoice
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {draft.parts.map((p, i) => (
          <div key={p.key} className="flex items-center gap-2">
            <Input
              value={p.label}
              disabled={!canEdit}
              aria-label={`Invoice ${i + 1} name`}
              onChange={(e) =>
                setDraft({ ...draft, parts: draft.parts.map((x) => (x.key === p.key ? { ...x, label: e.target.value } : x)) })
              }
            />
            {canEdit && draft.parts.length > 1 && (
              <Button size="icon" variant="ghost" aria-label="Remove invoice" onClick={() => removePart(p.key)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
        {INVOICE_ITEMS.map((it) => (
          <div key={it.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div>
              <div className="text-sm font-medium">{it.label}</div>
              <div className="text-[11px] text-muted-foreground">{it.hint}</div>
            </div>
            <Select
              value={draft.assign[it.key]}
              disabled={!canEdit}
              onValueChange={(v) => setDraft({ ...draft, assign: { ...draft.assign, [it.key]: v } })}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {draft.parts.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label || p.key}</SelectItem>
                ))}
                <SelectItem value={EXCLUDE}>Not billed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save invoice rules
          </Button>
        </div>
      )}
    </div>
  );
}
