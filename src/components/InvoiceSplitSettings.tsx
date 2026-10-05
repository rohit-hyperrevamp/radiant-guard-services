import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import {
  DEFAULT_SPLIT,
  EXCLUDE,
  INVOICE_ITEMS,
  loadOrgInvoiceSplit,
  type InvoiceItemKey,
  type InvoiceSplit,
} from "@/lib/invoice-split";

/** Organization-level invoice format: each invoice picks what it includes. */
export function OrgInvoiceFormatDialog({
  customer,
  onOpenChange,
}: {
  customer: { id: string; name: string; code: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const customerId = customer?.id ?? null;
  const { data, isLoading } = useQuery({
    queryKey: ["org-invoice-split", customerId],
    enabled: !!customerId,
    queryFn: () => loadOrgInvoiceSplit(customerId),
  });
  const [draft, setDraft] = useState<InvoiceSplit>(DEFAULT_SPLIT);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const addInvoice = () => {
    let n = draft.parts.length + 1;
    while (draft.parts.some((p) => p.key === `part${n}`)) n++;
    setDraft({ ...draft, parts: [...draft.parts, { key: `part${n}`, label: `Invoice ${draft.parts.length + 1}` }] });
  };
  const removeInvoice = (key: string) => {
    const parts = draft.parts.filter((p) => p.key !== key);
    const assign = { ...draft.assign };
    for (const it of INVOICE_ITEMS) if (assign[it.key] === key) assign[it.key] = EXCLUDE;
    setDraft({ parts, assign });
  };
  const toggleItem = (part: string, item: InvoiceItemKey, on: boolean) => {
    setDraft({ ...draft, assign: { ...draft.assign, [item]: on ? part : EXCLUDE } });
  };

  const save = async () => {
    if (!customer) return;
    if (draft.parts.some((p) => !p.label.trim())) return toast.error("Give every invoice a name");
    setSaving(true);
    const simple = draft.parts.length === 1 && INVOICE_ITEMS.every((it) => draft.assign[it.key] !== EXCLUDE);
    const value = simple ? null : draft;
    const { error } = await supabase.from("customers").update({ invoice_split: value } as never).eq("id", customer.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["org-invoice-split"] });
    void logActivity({
      module: "Organizations",
      action: "update",
      entityType: "customers",
      entityId: customer.id,
      entityLabel: customer.name,
      details: { invoice_split: value },
    });
    toast.success("Invoice format saved");
    onOpenChange(false);
  };

  const notBilled = INVOICE_ITEMS.filter((it) => draft.assign[it.key] === EXCLUDE);

  return (
    <Dialog open={!!customer} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invoice format</DialogTitle>
          <DialogDescription>
            {customer?.name} — applies to every client of this organization. Each invoice gets its own number when finalised.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="space-y-3">
            {draft.parts.map((p, i) => {
              const included = INVOICE_ITEMS.filter((it) => draft.assign[it.key] === p.key);
              return (
                <div key={p.key} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={p.label}
                      aria-label={`Invoice ${i + 1} name`}
                      onChange={(e) =>
                        setDraft({ ...draft, parts: draft.parts.map((x) => (x.key === p.key ? { ...x, label: e.target.value } : x)) })
                      }
                    />
                    {draft.parts.length > 1 && (
                      <Button size="icon" variant="ghost" aria-label="Remove invoice" onClick={() => removeInvoice(p.key)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="mt-2 w-full justify-between font-normal">
                        <span className="truncate">
                          {included.length ? included.map((it) => it.label).join(", ") : "Choose what to include"}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      {INVOICE_ITEMS.map((it) => {
                        const owner = draft.parts.find((x) => x.key === draft.assign[it.key]);
                        const checked = draft.assign[it.key] === p.key;
                        return (
                          <label key={it.key} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-secondary">
                            <Checkbox checked={checked} onCheckedChange={(v) => toggleItem(p.key, it.key, v === true)} />
                            <span className="text-sm">
                              {it.label}
                              {!checked && owner && (
                                <span className="block text-[11px] text-muted-foreground">Now in {owner.label}</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addInvoice}>
              <Plus className="mr-1 h-4 w-4" /> Add invoice
            </Button>

            {notBilled.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not billed: {notBilled.map((it) => it.label).join(", ")}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
