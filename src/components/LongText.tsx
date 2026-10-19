import { useState } from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Shows long list text clamped to two lines, with a View button that opens
 * the full text in a pop-up. Short text renders as-is.
 */
export function LongText({
  text,
  title = "Details",
  limit = 70,
  className,
}: {
  text: string | null | undefined;
  title?: string;
  limit?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const value = (text ?? "").trim();
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (value.length <= limit) return <span className={cn("break-words", className)}>{value}</span>;
  return (
    <div className="flex min-w-0 max-w-[320px] items-start gap-1.5">
      <span className={cn("line-clamp-2 min-w-0 flex-1 break-words", className)}>{value}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
        aria-label={`View full ${title.toLowerCase()}`}
      >
        <Eye className="h-3.5 w-3.5" /> View
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {value}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
