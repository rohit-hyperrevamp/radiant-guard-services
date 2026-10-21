import { useState } from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ScrollingText } from "@/components/ScrollingText";
import { Button } from "@/components/ui/button";

/**
 * Single-line overflow scrolling, with full details available in a pop-up.
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
  if (value.length <= limit) return <ScrollingText text={value} className={className} />;
  return (
    <div className="flex min-w-0 max-w-[320px] items-center gap-1.5">
      <ScrollingText text={value} className={cn("flex-1", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
        aria-label={`View full ${title.toLowerCase()}`}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
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
