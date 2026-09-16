import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** Optional middle action, e.g. "Save draft". */
  extraText?: string;
  /** Hide the cancel button — used for one-button acknowledgements. */
  hideCancel?: boolean;
  tone?: "default" | "warning" | "success";
};

export type ConfirmChoice = "confirm" | "extra" | "cancel";

type Ctx = (opts?: ConfirmOptions) => Promise<boolean>;
type ChoiceCtx = (opts?: ConfirmOptions) => Promise<ConfirmChoice>;

const ConfirmContext = createContext<Ctx | null>(null);

let dispatcher: ChoiceCtx | null = null;

/** Module-level confirm — works anywhere without hooks. */
export function confirmAction(opts?: ConfirmOptions): Promise<boolean> {
  if (dispatcher) return dispatcher(opts).then((r) => r === "confirm");
  if (typeof window === "undefined") return Promise.resolve(true);
  return Promise.resolve(
    window.confirm(opts?.description ?? opts?.title ?? "Are you sure?"),
  );
}

/** Confirm with up to three outcomes (confirm / extra / cancel). */
export function confirmChoice(opts?: ConfirmOptions): Promise<ConfirmChoice> {
  if (dispatcher) return dispatcher(opts);
  if (typeof window === "undefined") return Promise.resolve("cancel");
  return Promise.resolve(
    window.confirm(opts?.description ?? opts?.title ?? "Are you sure?") ? "confirm" : "cancel",
  );
}

/**
 * Shared "you have unsaved changes" prompt used by every form in the portal.
 * Returns "discard" to close, "draft" to save a draft first, "stay" to keep editing.
 */
export async function confirmDiscardChanges(options?: {
  what?: string;
  canSaveDraft?: boolean;
}): Promise<"discard" | "draft" | "stay"> {
  const what = options?.what ?? "form";
  const result = await confirmChoice({
    title: "Close without saving?",
    description: `Your changes to this ${what} are not saved yet. Save a draft to continue later, or discard them.`,
    confirmText: "Discard changes",
    extraText: options?.canSaveDraft ? "Save draft" : undefined,
    cancelText: "Keep editing",
    destructive: true,
    tone: "warning",
  });
  if (result === "confirm") return "discard";
  if (result === "extra") return "draft";
  return "stay";
}

/** Shared success acknowledgement popup used after a form saves. */
export function notifySaved(options: {
  title?: string;
  description?: string;
  actionText?: string;
}): Promise<boolean> {
  return confirmAction({
    title: options.title ?? "Saved",
    description: options.description ?? "Your changes have been saved.",
    confirmText: options.actionText ?? "Done",
    hideCancel: true,
    tone: "success",
  });
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((v: ConfirmChoice) => void) | null>(null);

  const request = useCallback<ChoiceCtx>((o) => {
    setOpts(o ?? {});
    setOpen(true);
    return new Promise<ConfirmChoice>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // Register/unregister module-level dispatcher.
  if (dispatcher !== request) dispatcher = request;

  const confirm = useCallback<Ctx>((o) => request(o).then((r) => r === "confirm"), [request]);

  const settle = (v: ConfirmChoice) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(v);
  };

  const tone = opts.tone ?? "default";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => !o && settle("cancel")}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            {tone !== "default" && (
              <span
                className={
                  tone === "success"
                    ? "mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                    : "mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600"
                }
              >
                {tone === "success" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </span>
            )}
            <AlertDialogTitle>{opts.title ?? "Confirm action"}</AlertDialogTitle>
            <AlertDialogDescription>
              {opts.description ?? "Proceed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            {!opts.hideCancel && (
              <AlertDialogCancel className="mt-0 rounded-xl" onClick={() => settle("cancel")}>
                {opts.cancelText ?? "Cancel"}
              </AlertDialogCancel>
            )}
            {opts.extraText && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => settle("extra")}
              >
                {opts.extraText}
              </Button>
            )}
            <AlertDialogAction
              className={
                opts.destructive
                  ? "rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "rounded-xl"
              }
              onClick={() => settle("confirm")}
            >
              {opts.confirmText ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Ctx {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback: native confirm so calls never crash if provider missing.
    return async (o) =>
      typeof window === "undefined"
        ? true
        : window.confirm(o?.description ?? o?.title ?? "Are you sure?");
  }
  return ctx;
}
