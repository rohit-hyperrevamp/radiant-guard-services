import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { verifyPanComprehensive, type PanComprehensiveResult } from "@/lib/surepass.functions";

type Props = {
  pan: string;
  /** Aadhaar typed in the form — used only to flag Aadhaar↔PAN mismatches. */
  aadhaar?: string;
  /** Name as per Aadhaar/DigiLocker — used only to flag name mismatches. */
  name?: string;
  verified?: boolean;
  onVerified: (result: PanComprehensiveResult) => void;
};

const normalise = (v: string) =>
  (v ?? "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** PAN Comprehensive verification during candidate onboarding. */
export function PanVerify({ pan, aadhaar, name, verified = false, onVerified }: Props) {
  const verify = useServerFn(verifyPanComprehensive);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const clean = (pan ?? "").trim().toUpperCase();
  const ready = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean);
  const attemptedRef = useRef("");

  const run = async () => {
    setBusy(true);
    setWarnings([]);
    try {
      const result = await verify({ data: { pan: clean } });
      if (!result.verified) {
        toast.error(result.message || "PAN could not be verified");
        setSummary(result.message);
        return;
      }

      const flags: string[] = [];
      if (result.pan_status && !/valid|^e$|active/i.test(result.pan_status)) {
        flags.push(`PAN status reported as "${result.pan_status}"`);
      }
      if (name && result.full_name && normalise(name) !== normalise(result.full_name)) {
        flags.push(`Name differs from Income Tax records (${result.full_name})`);
      }
      const aadhaarDigits = (aadhaar ?? "").replace(/\D/g, "");
      if (!result.aadhaar_linked) {
        flags.push("PAN is not seeded/linked with Aadhaar");
      } else if (aadhaarDigits.length === 12 && result.masked_aadhaar) {
        const last4 = result.masked_aadhaar.replace(/\D/g, "").slice(-4);
        if (last4 && last4 !== aadhaarDigits.slice(-4)) {
          flags.push("PAN is linked to a different Aadhaar number");
        }
      }

      setWarnings(flags);
      setSummary(
        [result.pan_type || result.category, result.pan_status, result.aadhaar_linked ? "Aadhaar linked" : null]
          .filter(Boolean)
          .join(" · "),
      );
      onVerified(result);
      toast.success(flags.length ? "PAN verified with warnings" : "PAN verified — details filled in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PAN verification failed");
    } finally {
      setBusy(false);
    }
  };

  // Zero-click UX: as soon as a complete, well-formed PAN is typed, verify it
  // automatically. The button below is only a retry affordance.
  useEffect(() => {
    if (!ready || verified || busy) return;
    if (attemptedRef.current === clean) return;
    const timer = window.setTimeout(() => {
      attemptedRef.current = clean;
      void run();
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, ready, verified, busy]);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {verified ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">PAN verified with Income Tax records</p>
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled={!ready || busy} onClick={() => void run()}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
            {busy ? "Verifying PAN…" : attemptedRef.current === clean ? "Retry PAN check" : "Verify PAN"}
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          {summary ??
            (busy
              ? "Checking PAN with Income Tax records…"
              : ready
                ? "Verifies automatically — checks PAN status, name, father's name and Aadhaar linking."
                : "Enter a valid PAN — it verifies itself automatically.")}
        </span>
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" /> {warning}
        </p>
      ))}
    </div>
  );
}
