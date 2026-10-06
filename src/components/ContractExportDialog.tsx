import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/SearchSelect";
import { cn } from "@/lib/utils";

export type ExportableContract = {
  id: string;
  orgId?: string;
  orgName?: string;
  stateLabel?: string;
  unitId?: string;
  unitCode?: string;
  unitName?: string;
  contractCode?: string | null;
  prospectCode?: string | null;
};

type Scope = "shown" | "organization" | "state" | "client" | "contract";
const SCOPES: { key: Scope; label: string }[] = [
  { key: "shown", label: "Current list" },
  { key: "organization", label: "Organization" },
  { key: "state", label: "State" },
  { key: "client", label: "Client" },
  { key: "contract", label: "Single contract" },
];

export function ContractExportDialog<T extends ExportableContract>({
  open,
  onOpenChange,
  all,
  shown,
  onExportList,
  onExportOne,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  all: T[];
  shown: T[];
  onExportList: (rows: T[], label: string) => void;
  onExportOne: (row: T) => Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>("shown");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of all) {
      if (scope === "organization" && c.orgId) m.set(c.orgId, c.orgName || "—");
      if (scope === "state" && c.stateLabel) m.set(c.stateLabel, c.stateLabel);
      if (scope === "client" && c.unitId) m.set(c.unitId, `${c.unitCode ?? ""} – ${c.unitName ?? ""}`);
      if (scope === "contract") m.set(c.id, `${c.contractCode || c.prospectCode || "—"} · ${c.unitCode ?? ""} ${c.unitName ?? ""}`);
    }
    return Array.from(m, ([v, label]) => ({ value: v, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [all, scope]);

  const rows = useMemo(() => {
    if (scope === "shown") return shown;
    if (!value) return [];
    return all.filter((c) =>
      scope === "organization" ? c.orgId === value
      : scope === "state" ? c.stateLabel === value
      : scope === "client" ? c.unitId === value
      : c.id === value,
    );
  }, [scope, value, all, shown]);

  const run = async () => {
    if (rows.length === 0) return;
    if (scope === "contract") {
      setBusy(true);
      try { await onExportOne(rows[0]!); onOpenChange(false); } finally { setBusy(false); }
      return;
    }
    const label = scope === "shown" ? "client-contracts" : `contracts-${options.find((o) => o.value === value)?.label ?? scope}`;
    onOpenChange(false);
    onExportList(rows, label.replace(/[^\w-]+/g, "-").slice(0, 60));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export contracts</DialogTitle>
          <DialogDescription>Choose what to export: by organization, state, client, or one contract.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setScope(s.key); setValue(""); }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                scope === s.key ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {scope !== "shown" && (
          <SearchSelect
            value={value}
            onChange={setValue}
            options={options}
            placeholder={`Select ${SCOPES.find((s) => s.key === scope)?.label.toLowerCase()}…`}
          />
        )}
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "contract" : "contracts"}
            {scope === "contract" && rows.length ? " · full rate sheet (Excel)" : ""}
          </span>
          <Button onClick={run} disabled={rows.length === 0 || busy}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
