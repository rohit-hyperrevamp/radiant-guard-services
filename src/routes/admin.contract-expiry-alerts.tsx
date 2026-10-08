import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/admin/contract-expiry-alerts")({
  head: () => ({
    meta: [
      { title: "Contract Expiry Alerts — Radiant Guard" },
      { name: "description", content: "Choose how many days before a contract expires reminders are sent." },
      { property: "og:title", content: "Contract Expiry Alerts — Radiant Guard" },
      { property: "og:description", content: "Configure the contract expiry reminder schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractExpiryAlertsPage,
});

const QK = ["contract-expiry-alert-settings"] as const;
const PRESETS = [180, 120, 90, 60, 45, 30, 15, 10, 7, 5, 3, 2, 1];

type Row = { days_before: number[]; enabled: boolean };

function ContractExpiryAlertsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_expiry_alert_settings" as never)
        .select("days_before, enabled")
        .maybeSingle();
      if (error) throw error;
      return (data as Row | null) ?? { days_before: [90, 60, 45, 30, 15, 10, 5, 3, 2, 1], enabled: true };
    },
  });
  const [days, setDays] = useState<number[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (q.data) {
      setDays([...q.data.days_before].sort((a, b) => b - a));
      setEnabled(q.data.enabled);
    }
  }, [q.data]);

  const toggle = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => b - a)));

  const addCustom = () => {
    const n = Number(custom);
    if (!Number.isInteger(n) || n < 1 || n > 730) {
      toast.error("Enter a whole number of days between 1 and 730.");
      return;
    }
    if (!days.includes(n)) setDays([...days, n].sort((a, b) => b - a));
    setCustom("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const after = { days_before: days, enabled };
      const { error } = await supabase
        .from("contract_expiry_alert_settings" as never)
        .upsert({ id: true, ...after, updated_at: new Date().toISOString() } as never);
      if (error) throw error;
      await logActivity({
        module: "Contract Expiry Alerts",
        action: "update",
        entityType: "contract_expiry_alert_settings",
        entityLabel: "Reminder schedule",
        before: q.data ?? null,
        after,
      });
    },
    onSuccess: () => {
      toast.success("Reminder schedule saved");
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const label = (d: number) => (d % 30 === 0 && d >= 30 ? `${d / 30} month${d === 30 ? "" : "s"} (${d}d)` : `${d} day${d === 1 ? "" : "s"}`);
  const options = Array.from(new Set([...PRESETS, ...days])).sort((a, b) => b - a);

  return (
    <div className="space-y-5 p-1 sm:p-6">
      <PageHeader
        title="Contract Expiry Alerts"
        description="Pick how long before a contract ends people get reminded. Everyone who can see the contract gets it in their live feed and notifications."
        crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Contract Expiry Alerts" }]}
      />
      <div className="max-w-3xl space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-foreground">Send expiry reminders</div>
            <div className="text-sm text-muted-foreground">Checked every morning.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-foreground">Remind this many days before expiry</div>
          <div className="flex flex-wrap gap-2">
            {options.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(d)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")
                  }
                >
                  {label(d)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex max-w-xs gap-2">
            <Input
              type="number"
              min={1}
              placeholder="Other, e.g. 75"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <Button type="button" variant="outline" onClick={addCustom}>Add</Button>
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {days.length === 0 ? (
            "No reminders selected."
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              Sequence:
              {days.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-foreground">
                  {label(d)}
                  <button type="button" aria-label={`Remove ${d}`} onClick={() => toggle(d)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </span>
          )}
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending || q.isLoading}>
          {save.isPending ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </div>
  );
}
