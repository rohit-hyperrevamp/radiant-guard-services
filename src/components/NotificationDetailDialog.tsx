import { formatDistanceToNow, format } from "date-fns";
import { Bell, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/lib/notifications";

type Props = {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLink?: (link: string) => void;
};

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  onOpenLink,
}: Props) {
  const n = notification;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-responsive sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug">
                {n?.title || "Notification"}
              </DialogTitle>
              {n?.createdAt && (
                <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  {" · "}
                  {format(new Date(n.createdAt), "d MMM yyyy, HH:mm")}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {n?.message && (
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-foreground/90">
            {n.message}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {n?.link && onOpenLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenLink(n.link);
                onOpenChange(false);
              }}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open page
            </Button>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
