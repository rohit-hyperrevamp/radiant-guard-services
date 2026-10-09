import { useRef } from "react";
import { Download, Eye, FileUp, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PendingDocument } from "@/lib/named-documents";

export function NamedDocumentsPicker({
  value,
  onChange,
  disabled,
}: {
  value: PendingDocument[];
  onChange: (value: PendingDocument[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Documents</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <FileUp className="mr-1.5 h-4 w-4" />
          Add documents
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            onChange([
              ...value,
              ...Array.from(e.target.files ?? []).map((file) => ({
                id: crypto.randomUUID(),
                file,
                title: file.name.replace(/\.[^.]+$/, ""),
              })),
            ]);
            e.target.value = "";
          }}
        />
      </div>
      {value.map((doc) => (
        <div key={doc.id} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">Document name</span>
            <Input
              disabled={disabled}
              value={doc.title}
              placeholder="e.g. Court notice"
              onChange={(e) =>
                onChange(value.map((d) => (d.id === doc.id ? { ...d, title: e.target.value } : d)))
              }
            />
            <span className="block truncate text-xs text-muted-foreground" title={doc.file.name}>
              {doc.file.name}
            </span>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            title="Remove document"
            aria-label={`Remove ${doc.title}`}
            onClick={() => onChange(value.filter((d) => d.id !== doc.id))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </section>
  );
}

export function SavedDocumentRow({
  title,
  filename,
  date,
  onView,
  onDownload,
}: {
  title: string;
  filename: string;
  date?: string;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border py-3 last:border-0">
      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground" title={filename}>
          {filename}
          {date ? ` · ${date}` : ""}
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title="View document"
        aria-label={`View ${title}`}
        onClick={onView}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title="Download document"
        aria-label={`Download ${title}`}
        onClick={onDownload}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
