import { Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { isNativePlatform } from "@/lib/native";
import { cn } from "@/lib/utils";

export type BottomNavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  to?: string;
  onClick?: () => void;
  active?: boolean;
};

export type BottomNavMoreItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  to: string;
  active?: boolean;
};

/**
 * Fixed bottom tab bar for mobile / native shells.
 * Shows up to 4 primary destinations + a "More" tab that opens
 * the full navigation drawer. Respects iOS safe-area inset.
 */
export function MobileBottomNav({
  items,
  onMore,
  moreActive,
  hideMore = false,
  moreItems = [],
}: {
  items: BottomNavItem[];
  onMore: () => void;
  moreActive?: boolean;
  hideMore?: boolean;
  moreItems?: BottomNavMoreItem[];
}) {
  const primary = items.slice(0, 4);
  const [nativeShell, setNativeShell] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setNativeShell(isNativePlatform());
    setPortalTarget(document.body);
  }, []);

  const nav = (
    <>
      {moreActive && (
        <button
          type="button"
          aria-label="Close more apps"
          className="fixed inset-0 z-[79] bg-foreground/20 backdrop-blur-[2px] lg:hidden"
          onClick={onMore}
        />
      )}
      <nav
      aria-label="Primary"
      data-bottom-nav
      data-expanded={moreActive ? "true" : "false"}
      className={cn(
        "fixed left-[max(0.5rem,env(safe-area-inset-left,0px))] right-[max(0.5rem,env(safe-area-inset-right,0px))] bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-[80] rounded-[20px] border border-dock-foreground/15 bg-dock text-dock-foreground shadow-xl backdrop-blur-xl",
        !nativeShell && "lg:hidden",
      )}
    >
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          moreActive ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[min(62dvh,32rem)] overflow-y-auto overscroll-contain px-2.5 pb-1 pt-3">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <span className="text-[13px] font-medium text-dock-foreground">More apps</span>
            </div>
            <div data-app-drawer-grid className="grid grid-cols-2 gap-1.5 pb-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={onMore}
                    className={cn(
                      "grid min-h-12 min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors",
                      item.active
                        ? "bg-dock-foreground text-dock"
                        : "bg-dock-foreground/[0.07] text-dock-foreground/75 active:bg-dock-foreground/[0.13]",
                    )}
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.active ? "bg-dock/10" : "bg-dock-foreground/[0.08]") }>
                      <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
                    </span>
                    <span className="truncate text-[11px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <ul className="mx-auto grid h-14 w-full max-w-xl grid-flow-col auto-cols-fr items-stretch gap-1 px-1.5 py-1">
        {primary.map((it) => {
          const Icon = it.icon;
          const inner = (
            <div
              className={cn(
                "relative mx-auto flex h-full min-w-0 max-w-[76px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 transition-colors",
                it.active ? "text-accent" : "text-dock-foreground/60",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-9 place-items-center rounded-lg transition-colors",
                    it.active
                     ? "text-accent"
                     : "text-dock-foreground/60",
                )}
              >
                <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={it.active ? 2.5 : 2} />
              </span>
              <span
                className={cn(
                  "block w-full truncate whitespace-nowrap text-center text-[9px] leading-none",
                  it.active ? "font-medium text-accent" : "font-normal text-dock-foreground/60",
                )}
              >
                {it.label}
              </span>
              {it.active && <span aria-hidden className="absolute -bottom-0.5 h-0.5 w-4 rounded-full bg-accent" />}
            </div>
          );
          const tapClass = "block h-full w-full select-none rounded-xl outline-none [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-ring active:opacity-80";
          return (
            <li key={it.key} className="min-w-0">
              {it.to ? (
                <Link to={it.to} aria-current={it.active ? "page" : undefined} className={tapClass}>{inner}</Link>
              ) : (
                <Button type="button" variant="ghost" onClick={it.onClick} className={cn(tapClass, "p-0")}>{inner}</Button>
              )}
            </li>
          );
        })}
        {!hideMore && (
        <li className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onMore}
            aria-label="More"
            className="block h-full w-full select-none rounded-xl p-0 outline-none [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-ring active:opacity-80"
          >
             <div className={cn("relative mx-auto flex h-full min-w-0 max-w-[76px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 transition-colors", moreActive ? "text-accent" : "text-dock-foreground/60")}>
              <span
                className={cn(
                  "grid h-6 w-9 place-items-center rounded-lg transition-colors",
                  moreActive ? "text-accent" : "text-dock-foreground/60",
                )}
              >
                <LayoutGrid className="h-[19px] w-[19px] shrink-0" strokeWidth={moreActive ? 2.5 : 2} />
              </span>
                <span className={cn("block w-full truncate whitespace-nowrap text-center text-[9px] leading-none", moreActive ? "font-medium text-accent" : "font-normal text-dock-foreground/60")}>
                More
              </span>
                {moreActive && <span aria-hidden className="absolute -bottom-0.5 h-0.5 w-4 rounded-full bg-accent" />}
            </div>
          </Button>
        </li>
        )}
      </ul>
      </nav>
    </>
  );

  return portalTarget ? createPortal(nav, portalTarget) : nav;
}
