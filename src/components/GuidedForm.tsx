import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDiscardChanges } from "@/components/ConfirmProvider";
import { cn } from "@/lib/utils";

export type GuidedFormStep = {
  key: string;
  label: string;
  caption: string;
};

type GuidedFormProps = {
  title: string;
  steps: GuidedFormStep[];
  stepKey: string;
  onStepChange: (key: string) => void;
  isStepComplete: (key: string) => boolean;
  onCancel: () => void;
  onSaveDraft?: () => void;
  onSubmit: () => void;
  saving?: boolean;
  savingDraft?: boolean;
  submitLabel?: string;
  /** Override the automatic edit detection used by the close prompt. */
  isDirty?: boolean;
  /** Word used in the close prompt, e.g. "client". */
  entityLabel?: string;
  /**
   * Receives the guarded close handler so the surrounding dialog can route
   * Esc, outside clicks and the header X through the same unsaved-work prompt.
   */
  closeGuardRef?: MutableRefObject<(() => void) | null>;
  children: ReactNode;
};

/**
 * Wire a dialog's own close paths (Esc, outside click, header X) to the
 * GuidedForm unsaved-work prompt:
 *   const closeGuard = useGuidedFormCloseGuard(() => onOpenChange(false));
 *   <Dialog open={open} onOpenChange={closeGuard.onOpenChange}>
 *     <GuidedForm closeGuardRef={closeGuard.ref} ... />
 */
export function useGuidedFormCloseGuard(close: () => void) {
  const ref = useRef<(() => void) | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  return useMemo(
    () => ({
      ref,
      onOpenChange: (open: boolean) => {
        if (open) return;
        if (ref.current) ref.current();
        else closeRef.current();
      },
    }),
    [],
  );
}

export function GuidedForm({
  title,
  steps,
  stepKey,
  onStepChange,
  isStepComplete,
  onCancel,
  onSaveDraft,
  onSubmit,
  saving = false,
  savingDraft = false,
  submitLabel = "Save",
  isDirty,
  entityLabel,
  closeGuardRef,
  children,
}: GuidedFormProps) {
  const stepIndex = Math.max(0, steps.findIndex((step) => step.key === stepKey));
  const currentStep = steps[stepIndex] ?? steps[0];
  const completed = steps.filter((step) => isStepComplete(step.key)).length;
  const completion = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const isLast = stepIndex === steps.length - 1;

  // Any typing or selection inside the form body counts as unsaved work.
  const touchedRef = useRef(false);
  const markTouched = () => { touchedRef.current = true; };
  const markTouchedFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.('input, textarea, select, button, [role="combobox"], [role="checkbox"], [role="switch"], [contenteditable="true"]')) return;
    touchedRef.current = true;
  };
  const requestCancel = async () => {
    const dirty = isDirty ?? touchedRef.current;
    if (!dirty) {
      onCancel();
      return;
    }
    const choice = await confirmDiscardChanges({
      what: entityLabel ?? title.toLowerCase(),
      canSaveDraft: !!onSaveDraft,
    });
    if (choice === "stay") return;
    if (choice === "draft") {
      onSaveDraft?.();
      return;
    }
    touchedRef.current = false;
    onCancel();
  };

  // Expose the same prompt to the dialog's Esc / outside-click / header X.
  if (closeGuardRef) closeGuardRef.current = () => void requestCancel();



  return (
    <div className="guided-form flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col justify-between border-r border-border/60 bg-card px-6 py-7 lg:flex">
        <div className="min-h-0">
          <p className="text-xs font-semibold text-muted-foreground">Setup</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
          <nav aria-label={`${title} steps`} className="mt-7 space-y-1 overflow-y-auto">
            {steps.map((step, index) => {
              const active = index === stepIndex;
              const done = isStepComplete(step.key);
              return (
                <Button
                  key={step.key}
                  type="button"
                  variant="ghost"
                  onClick={() => onStepChange(step.key)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "h-auto w-full justify-start gap-3 rounded-lg px-2.5 py-2.5 text-left shadow-none",
                    active && "bg-accent/10 text-accent ring-1 ring-accent/20 hover:bg-accent/10 hover:text-accent",
                    !active && done && "text-accent hover:bg-accent/10 hover:text-accent",
                    !active && !done && "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <span className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                    active && "border-accent bg-accent text-accent-foreground ring-4 ring-accent/10",
                    !active && done && "border-accent/40 bg-accent/15 text-accent",
                    !active && !done && "border-border bg-card",
                  )}>
                    {done ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{step.label}</span>
                    {active && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{step.caption}</span>}
                  </span>
                </Button>
              );
            })}
          </nav>
        </div>
        <div className="mt-6 shrink-0 rounded-xl border border-accent/20 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Completion</span>
            <span className="font-semibold tabular-nums">{completion}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completion}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{completed} of {steps.length} sections</p>
        </div>
      </aside>

      <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
        <div className="border-b border-border/60 px-3 py-2.5 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-accent">{stepIndex + 1} of {steps.length}</p>
              <p className="truncate text-base font-semibold">{currentStep?.label}</p>
            </div>
            <span className="text-xs font-semibold tabular-nums">{completion}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completion}%` }} />
          </div>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {steps.map((step, index) => (
              <Button
                key={step.key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onStepChange(step.key)}
                className={cn(
                   "h-8 shrink-0 rounded-lg px-2 text-[11px]",
                  index === stepIndex && "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground",
                  index !== stepIndex && isStepComplete(step.key) && "border-accent/30 bg-accent/10 text-accent",
                )}
              >
                {isStepComplete(step.key) && <Check className="mr-1 h-3 w-3" />}
                {step.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-7 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 hidden lg:block">
              <p className="text-xs font-medium text-accent">Step {stepIndex + 1} of {steps.length}</p>
              <h3 className="mt-1 text-2xl font-semibold">{currentStep?.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{currentStep?.caption}</p>
            </div>
            <div onInputCapture={markTouched} onChangeCapture={markTouched} onPointerDownCapture={markTouchedFromPointer}>
              {children}
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-1.5 border-t border-border/60 bg-card px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6 sm:py-3">
          {stepIndex === 0 ? (
            <Button type="button" variant="outline" onClick={() => void requestCancel()}>Cancel</Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onStepChange(steps[stepIndex - 1]?.key ?? stepKey)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onSaveDraft} disabled={!onSaveDraft || savingDraft || saving}>
            <Save className="mr-1 h-4 w-4" /> {savingDraft ? "Saving…" : "Draft"}
          </Button>
          {isLast ? (
            <Button type="button" onClick={onSubmit} disabled={saving || savingDraft}>{saving ? "Saving…" : submitLabel}</Button>
          ) : (
            <Button type="button" onClick={() => onStepChange(steps[stepIndex + 1]?.key ?? stepKey)}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useGuidedFormDraft<T>({
  open,
  storageKey,
  value,
  onRestore,
  isMeaningful,
}: {
  open: boolean;
  storageKey: string | null;
  value: T;
  onRestore: (value: T) => void;
  isMeaningful: (value: T) => boolean;
}) {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (!open || !storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt?: number; value?: T };
      if (!parsed.value || (parsed.savedAt && Date.now() - parsed.savedAt > 86_400_000)) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      if (isMeaningful(parsed.value)) setHasDraft(true);
    } catch {
      setHasDraft(false);
    }
  }, [open, storageKey, isMeaningful]);

  useEffect(() => {
    if (!open || !storageKey || !isMeaningful(value)) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), value }));
        setHasDraft(true);
      } catch {
        // Browser storage may be unavailable.
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [open, storageKey, value, isMeaningful]);

  return useMemo(() => ({
    hasDraft,
    restore() {
      if (!storageKey) return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { value?: T };
        if (parsed.value) onRestore(parsed.value);
        setHasDraft(false);
      } catch {
        setHasDraft(false);
      }
    },
    save() {
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), value }));
        setHasDraft(true);
      } catch {
        // Browser storage may be unavailable.
      }
    },
    clear() {
      if (storageKey) window.localStorage.removeItem(storageKey);
      setHasDraft(false);
    },
  }), [hasDraft, storageKey, value, onRestore]);
}