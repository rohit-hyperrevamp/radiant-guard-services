import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Building2,
  CalendarCheck,
  CheckCheck,
  ChevronRight,
  FileSignature,
  MapPinned,
  Package,
  ReceiptIndianRupee,
  ShieldAlert,
  UserRound,
  Volume2,
  VolumeX,
  WalletCards,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listMyNotifications,
  markAllRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications";
import {
  isNotificationSoundMuted,
  playNotificationChime,
  setNotificationSoundMuted,
} from "@/lib/notification-sound";
import { shouldRedirect } from "@/lib/notification-routing";
import { filterNotificationsByAccess } from "@/lib/notification-access";
import { useCurrentPermissions } from "@/lib/rbac";
import { NotificationDetailDialog } from "@/components/NotificationDetailDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { isNativePlatform } from "@/lib/native";

const NQK = ["notifications", "mine"] as const;

function notificationVisual(type: string) {
  const value = type.toLowerCase();
  if (value.startsWith("attendance")) return { Icon: CalendarCheck, tone: "bg-chart-2/15 text-chart-2 ring-chart-2/20" };
  if (value.startsWith("payroll")) return { Icon: WalletCards, tone: "bg-chart-4/15 text-chart-4 ring-chart-4/20" };
  if (value.startsWith("invoice")) return { Icon: ReceiptIndianRupee, tone: "bg-chart-3/15 text-chart-3 ring-chart-3/20" };
  if (value.startsWith("employee") || value.startsWith("candidate") || value.startsWith("rehire")) {
    return { Icon: UserRound, tone: "bg-chart-1/15 text-chart-1 ring-chart-1/20" };
  }
  if (value.startsWith("contract")) return { Icon: FileSignature, tone: "bg-chart-5/15 text-chart-5 ring-chart-5/20" };
  if (value.startsWith("inventory")) return { Icon: Package, tone: "bg-chart-3/15 text-chart-3 ring-chart-3/20" };
  if (value.startsWith("client") || value.startsWith("organization") || value.startsWith("unit")) {
    return { Icon: Building2, tone: "bg-chart-1/15 text-chart-1 ring-chart-1/20" };
  }
  if (value.startsWith("field")) return { Icon: MapPinned, tone: "bg-chart-2/15 text-chart-2 ring-chart-2/20" };
  if (value.includes("alert") || value.includes("warning") || value.includes("expiry")) {
    return { Icon: ShieldAlert, tone: "bg-destructive/10 text-destructive ring-destructive/20" };
  }
  return { Icon: BellRing, tone: "bg-accent/12 text-accent ring-accent/20" };
}

export function NotificationBell({ triggerClassName }: { triggerClassName?: string } = {}) {
  const qc = useQueryClient();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [nativeShell, setNativeShell] = useState(false);
  const [drawerMode, setDrawerMode] = useState(false);
  const mobileSheet = isMobile || nativeShell || drawerMode;
  const { can } = useCurrentPermissions();
  const { data: raw = [] } = useQuery({
    queryKey: NQK,
    queryFn: listMyNotifications,
    refetchInterval: 10_000,
  });
  // Only notifications for modules this role can access (RBAC-driven).
  const items = filterNotificationsByAccess(raw, can);
  const unread = items.filter((n) => !n.readAt).length;
  const top = items.slice(0, 8);

  // Track seen notification IDs so we only chime on genuinely new arrivals.
  const seenRef = useRef<Set<string> | null>(null);
  const [muted, setMuted] = useState<boolean>(() => isNotificationSoundMuted());
  const [detail, setDetail] = useState<Notification | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const isNative = isNativePlatform();
      setNativeShell(isNative);
      setDrawerMode(isNative || window.innerWidth < 1024);
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const currentIds = items.map((n) => n.id);
    if (seenRef.current === null) {
      seenRef.current = new Set(currentIds);
      return;
    }
    const seen = seenRef.current;
    const newUnread = items.filter((n) => !n.readAt && !seen.has(n.id));
    for (const id of currentIds) seen.add(id);
    if (newUnread.length > 0) {
      playNotificationChime();
    }
  }, [items]);

  const openLink = (target: string) => {
    if (!target) return;
    setMobileOpen(false);
    if (target.startsWith("/")) router.history.push(target);
    else if (typeof window !== "undefined") window.location.href = target;
  };

  const handleOpenNotification = async (n: Notification) => {
    if (!n.readAt) {
      await markNotificationRead(n.id);
      qc.invalidateQueries({ queryKey: NQK });
    }
    if (shouldRedirect(n.type) && n.link && n.link.trim()) {
      openLink(n.link);
    } else {
      setMobileOpen(false);
      setDetail(n);
    }
  };

  const trigger = (
    <button
      type="button"
      aria-label="Notifications"
      data-no-tip
      onClick={(event) => {
        const shouldOpenDrawer =
          mobileSheet ||
          (typeof window !== "undefined" && window.innerWidth < 1024) ||
          isNativePlatform();
        if (!shouldOpenDrawer) return;
        event.preventDefault();
        event.stopPropagation();
        setMobileOpen(true);
      }}
      className={triggerClassName ?? "relative inline-flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-full border border-border bg-card text-foreground outline-none transition-colors focus-visible:outline-none hover:border-accent hover:text-accent"}
      style={{ borderRadius: "9999px", flex: "0 0 40px" }}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );

  const notificationList = (
    <>
      <div className="flex items-center justify-between border-b border-border/60 px-4 pb-3 pt-2 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent ring-1 ring-inset ring-accent/20">
            <BellRing className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="text-[17px] font-medium leading-tight text-foreground">Notifications</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You’re all caught up"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setNotificationSoundMuted(next);
              setMuted(next);
              if (!next) playNotificationChime();
            }}
            aria-label={muted ? "Unmute notification sound" : "Mute notification sound"}
            title={muted ? "Sound off" : "Sound on"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground [-webkit-tap-highlight-color:transparent]"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            disabled={unread === 0}
            onClick={async () => {
              await markAllRead();
              qc.invalidateQueries({ queryKey: NQK });
            }}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/15 disabled:opacity-40 [-webkit-tap-highlight-color:transparent]"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all
          </button>
        </div>
      </div>
      <div className="max-h-[min(62dvh,28rem)] overflow-y-auto overscroll-contain px-2 py-2">
        {top.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/15">
              <BellRing className="h-6 w-6" />
            </div>
            <div className="text-sm font-semibold text-foreground">No notifications</div>
            <div className="mt-0.5 text-xs text-muted-foreground">New alerts will appear here.</div>
          </div>
        ) : (
          <ul className="space-y-1">
            {top.map((n) => {
              const { Icon, tone } = notificationVisual(n.type);
              return (
              <li key={n.id} className="overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={() => void handleOpenNotification(n)}
                  className={cn(
                    "flex w-full items-center gap-3 px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/60 [-webkit-tap-highlight-color:transparent] sm:px-3",
                    !n.readAt ? "bg-accent/[0.06]" : "bg-card/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                      tone,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="line-clamp-1 text-[13px] font-medium leading-snug text-foreground sm:text-[13.5px]">
                        {n.title}
                      </div>
                      {!n.readAt && (
                        <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    {n.message && (
                      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {n.message}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] font-medium text-muted-foreground/80">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              </li>
            );})}
          </ul>
        )}
      </div>
      <div className="border-t border-border/60 bg-card/80 px-3 pb-2 pt-2 backdrop-blur-xl">
        <Button asChild variant="secondary" size="sm" className="h-10 w-full justify-center rounded-xl text-xs font-medium" onClick={() => setMobileOpen(false)}>
          <Link to="/admin/notifications">View all notifications</Link>
        </Button>
      </div>
    </>
  );

  const notificationDrawer =
    mobileOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Notifications">
            <button
              type="button"
              aria-label="Close notifications"
              data-no-tip
               className="absolute inset-0 bg-foreground/40 backdrop-blur-md animate-in fade-in-0 duration-200"
              onClick={() => setMobileOpen(false)}
            />
            <div
               className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex max-h-[78dvh] flex-col overflow-hidden rounded-[24px] border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 ease-out"
              style={{
                 paddingBottom: "4px",
              }}
            >
               <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                <div className="w-8" aria-hidden="true" />
                <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                <button
                  type="button"
                  aria-label="Close notifications"
                  data-no-tip
                  onClick={() => setMobileOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground [-webkit-tap-highlight-color:transparent]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {notificationList}
            </div>
          </div>,
          document.body,
        )
      : null;

  if (mobileSheet) {
    return (
      <>
        {trigger}
        {notificationDrawer}
        <NotificationDetailDialog
          notification={detail}
          open={detail !== null}
          onOpenChange={(o) => { if (!o) setDetail(null); }}
          onOpenLink={openLink}
        />
      </>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        collisionPadding={12}
        avoidCollisions
        className={cn(
          "z-50 p-0 shadow-2xl",
          // Desktop / tablet: compact popover next to the sidebar
          "w-[min(22rem,calc(100vw-1.5rem))] rounded-xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        )}
      >
        {notificationList}
      </PopoverContent>
      <NotificationDetailDialog
        notification={detail}
        open={detail !== null}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        onOpenLink={openLink}
      />
      {notificationDrawer}
    </Popover>
  );
}

