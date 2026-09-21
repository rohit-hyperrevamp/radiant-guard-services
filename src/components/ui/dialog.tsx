"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/ConfirmProvider";

const DialogPortalContainerContext = React.createContext<HTMLElement | null>(null);

export function useDialogPortalContainer() {
  return React.useContext(DialogPortalContainerContext);
}

// ---- Dirty-guard plumbing -----------------------------------------------
type DirtyCtx = {
  dirtyRef: React.MutableRefObject<boolean>;
  reset: () => void;
  disabled: boolean;
  markDirty: () => void;
  markPristine: () => void;
};
const DialogDirtyContext = React.createContext<DirtyCtx | null>(null);

export const DialogDirtyGuardOff = ({ children }: { children: React.ReactNode }) => {
  const dirtyRef = React.useRef(false);
  return (
    <DialogDirtyContext.Provider
      value={{
        dirtyRef,
        reset: () => {},
        disabled: true,
        markDirty: () => {},
        markPristine: () => {},
      }}
    >
      {children}
    </DialogDirtyContext.Provider>
  );
};

type DialogRootProps = React.ComponentProps<typeof DialogPrimitive.Root>;

const Dialog = ({ onOpenChange, open, defaultOpen, children, ...props }: DialogRootProps) => {
  const dirtyRef = React.useRef(false);
  const ctxRef = React.useRef<DirtyCtx>({
    dirtyRef,
    reset: () => {
      dirtyRef.current = false;
    },
    disabled: false,
    markDirty: () => {
      dirtyRef.current = true;
    },
    markPristine: () => {
      dirtyRef.current = false;
    },
  });

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) {
        dirtyRef.current = false;
        onOpenChange?.(true);
        return;
      }
      if (!dirtyRef.current || ctxRef.current.disabled) {
        onOpenChange?.(false);
        return;
      }
      void confirmAction({
        title: "Discard unsaved changes?",
        description: "Any information you've entered will be lost.",
        confirmText: "Discard",
        cancelText: "Keep editing",
        destructive: true,
      }).then((ok) => {
        if (ok) {
          dirtyRef.current = false;
          onOpenChange?.(false);
        }
      });
    },
    [onOpenChange],
  );

  return (
    <DialogDirtyContext.Provider value={ctxRef.current}>
      <DialogPrimitive.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogDirtyContext.Provider>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
      className={cn(
        "fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
  responsive?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, overlayClassName, responsive, children, ...props }, ref) => {
  const [contentElement, setContentElement] = React.useState<HTMLElement | null>(null);
  const [pristine, setPristine] = React.useState(true);
  const dirtyCtx = React.useContext(DialogDirtyContext);

  const handleRef = React.useCallback(
    (node: React.ElementRef<typeof DialogPrimitive.Content> | null) => {
      setContentElement(node);
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  React.useEffect(() => {
    if (!contentElement || !dirtyCtx || dirtyCtx.disabled) return;
    dirtyCtx.reset();
    setPristine(true);
    requestAnimationFrame(() => contentElement.scrollTo?.({ top: 0, left: 0 }));
    const SAVE_RX = /^(save|update|create|submit|confirm|apply|generate|send|sign|next|continue|finish|done)\b/i;
    const ACTION_RX = /^(approve|reject|decline|acknowledge|enable|open)\b/i;

    const markDirty = (e: Event) => {
      if (!(e as UIEvent).isTrusted) return;
      if (!dirtyCtx.dirtyRef.current) {
        dirtyCtx.dirtyRef.current = true;
        setPristine(false);
      }
    };
    const markPristine = () => {
      dirtyCtx.reset();
      setPristine(true);
    };
    const closeDialog = () => {
      markPristine();
      requestAnimationFrame(() => {
        contentElement.querySelector<HTMLButtonElement>('[data-dialog-close]')?.click();
      });
    };
    dirtyCtx.markDirty = () => {
      if (!dirtyCtx.dirtyRef.current) {
        dirtyCtx.dirtyRef.current = true;
      }
      setPristine(false);
    };
    dirtyCtx.markPristine = markPristine;
    const onClick = (e: Event) => {
      const btn = (e.target as HTMLElement | null)?.closest?.("button") as HTMLButtonElement | null;
      if (!btn) return;
      const txt = (btn.textContent || "").trim();
      if (txt === "Close" || txt === "Cancel") closeDialog();
      if (ACTION_RX.test(txt)) { markPristine(); return; }
      if (btn.type === "submit" || SAVE_RX.test(txt)) markPristine();
    };

    const scan = () => {
      contentElement.querySelectorAll("button").forEach((b) => {
        const txt = (b.textContent || "").trim();
        const isSave = !ACTION_RX.test(txt) && (b.type === "submit" || SAVE_RX.test(txt));
        if (isSave) b.setAttribute("data-save-intent", "true");
        else b.removeAttribute("data-save-intent");
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(contentElement, { childList: true, subtree: true, characterData: true });

    contentElement.addEventListener("input", markDirty, true);
    contentElement.addEventListener("change", markDirty, true);
    contentElement.addEventListener("click", onClick, true);
    contentElement.addEventListener("submit", markPristine, true);
    return () => {
      dirtyCtx.markDirty = () => { dirtyCtx.dirtyRef.current = true; };
      dirtyCtx.markPristine = () => { dirtyCtx.reset(); };
      mo.disconnect();
      contentElement.removeEventListener("input", markDirty, true);
      contentElement.removeEventListener("change", markDirty, true);
      contentElement.removeEventListener("click", onClick, true);
      contentElement.removeEventListener("submit", markPristine, true);
    };
  }, [contentElement, dirtyCtx]);

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPortalContainerContext.Provider value={contentElement}>
        <DialogPrimitive.Content
          data-slot="dialog-content"
          ref={handleRef}
          data-pristine={pristine ? "true" : "false"}
          className={cn(
            "dialog-content-centered fixed inset-x-0 bottom-0 z-[110] grid h-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain gap-3 rounded-t-2xl border-x-0 border-b-0 border-t border-border/60 bg-card text-card-foreground p-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl data-[state=open]:animate-slide-in-from-bottom data-[state=closed]:animate-slide-out-to-bottom sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:h-auto sm:w-[calc(100vw-1.5rem)] sm:max-w-lg sm:max-h-[calc(100dvh-1.5rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:gap-4 sm:rounded-xl sm:border sm:p-6 sm:shadow-[0_24px_60px_-15px_rgba(15,23,42,0.25)] sm:data-[state=open]:animate-dialog-in sm:data-[state=closed]:animate-dialog-out",
            responsive && "dialog-responsive",
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close data-dialog-close className="absolute right-2.5 top-[max(0.625rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card text-foreground shadow-sm ring-offset-background transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-3 sm:top-3 sm:h-8 sm:w-8">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortalContainerContext.Provider>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-header" className={cn("flex flex-col space-y-1 border-b border-border/60 pb-2.5 pr-10 text-left sm:border-0 sm:pb-0 sm:pr-0", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn("sticky bottom-0 z-10 -mx-3 mt-auto flex flex-row gap-1.5 border-t border-border/60 bg-card/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl [&>*]:min-w-0 [&>*]:flex-1 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-none sm:[&>*]:flex-none", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    ref={ref}
    className={cn("text-base font-semibold leading-tight sm:text-lg", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    ref={ref}
    className={cn("hidden text-sm text-muted-foreground sm:block", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export function useDialogDirty() {
  const ctx = React.useContext(DialogDirtyContext);
  return React.useMemo(
    () => ({
      markPristine: () => ctx?.markPristine(),
      markDirty: () => ctx?.markDirty(),
    }),
    [ctx],
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
