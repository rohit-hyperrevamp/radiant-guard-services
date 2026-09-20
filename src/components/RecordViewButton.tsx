import { useState } from "react";
import { Edit2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Generic read-only record viewer. Shows every meaningful field of a row so
 * users never have to open the edit form just to read a record.
 */
const HIDDEN_KEYS = new Set([
  "id",
  "createdat",
  "updatedat",
  "createdby",
  "updatedby",
  "deletedat",
  "orgid",
  "tenantid",
]);

function humanize(key: string) {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  const label = spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  return label
    .replace(/\bid\b/gi, "ID")
    .replace(/\bgst\b/gi, "GST")
    .replace(/\bpan\b/gi, "PAN")
    .replace(/\besic\b/gi, "ESIC")
    .replace(/\bpf\b/gi, "PF")
    .replace(/\blwf\b/gi, "LWF")
    .replace(/\bpt\b/gi, "PT")
    .replace(/\buan\b/gi, "UAN")
    .replace(/\bot\b/gi, "ED");
}

function renderValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const parts = value
      .map((v) =>
        typeof v === "object" && v !== null
          ? (((v as Record<string, unknown>).name ??
              (v as Record<string, unknown>).label ??
              (v as Record<string, unknown>).code) as string | undefined)
          : String(v),
      )
      .filter(Boolean);
    return parts.length ? parts.join(", ") : `${value.length} item(s)`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const name = obj.name ?? obj.label ?? obj.code;
    return typeof name === "string" ? name : null;
  }
  return null;
}

export function RecordViewDialog({
  open,
  onOpenChange,
  record,
  title = "Details",
  subtitle,
  labels,
  hide,
  extra,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: object | null;
  title?: string;
  subtitle?: string;
  /** Override auto-generated labels for specific keys. */
  labels?: Record<string, string>;
  /** Extra keys to leave out. */
  hide?: string[];
  /** Additional read-only content, e.g. related lines. */
  extra?: React.ReactNode;
  onEdit?: () => void;
}) {
  if (!record) return null;
  const hidden = new Set([...HIDDEN_KEYS, ...(hide ?? []).map((k) => k.toLowerCase())]);
  const rows = Object.entries(record as Record<string, unknown>)
    .filter(([key]) => !hidden.has(key.toLowerCase()) && !/id$/i.test(key))
    .map(([key, value]) => [labels?.[key] ?? humanize(key), renderValue(value)] as const)
    .filter(([, value]) => value !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto sm:max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {subtitle ?? "Read-only view. Nothing here can be changed."}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No details recorded.
          </p>
        ) : (
          <dl className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-1 items-start gap-0.5 border-b border-border/60 px-1 py-2 last:border-0 min-[380px]:grid-cols-[minmax(6rem,36%)_minmax(0,1fr)] min-[380px]:gap-2 sm:block sm:rounded-xl sm:border sm:bg-card sm:px-3"
              >
                <dt className="text-[11px] font-semibold text-muted-foreground sm:uppercase">
                  {label}
                </dt>
                <dd className="min-w-0 break-words text-sm font-medium text-foreground sm:mt-0.5">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {extra ? <div className="mt-2">{extra}</div> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-no-confirm="true"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {onEdit && (
            <Button
              type="button"
              data-no-confirm="true"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              <Edit2 className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Drop-in row action: renders the eye button and owns its own dialog, so any
 * list can gain a proper read-only view with a single line of JSX.
 */
export function RecordViewButton({
  record,
  title,
  subtitle,
  labels,
  hide,
  extra,
  onEdit,
}: {
  record: object | null;
  title?: string;
  subtitle?: string;
  labels?: Record<string, string>;
  hide?: string[];
  extra?: React.ReactNode;
  onEdit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-accent"
        onClick={() => setOpen(true)}
        aria-label="View"
        title="View"
        data-no-confirm="true"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <RecordViewDialog
        open={open}
        onOpenChange={setOpen}
        record={record}
        title={title}
        subtitle={subtitle}
        labels={labels}
        hide={hide}
        extra={extra}
        onEdit={onEdit}
      />
    </>
  );
}
