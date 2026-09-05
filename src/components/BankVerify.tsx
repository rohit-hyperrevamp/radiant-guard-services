import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BadgeCheck, Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { verifyBankAccount, type BankVerificationResult } from "@/lib/surepass.functions";

type Props = {
  accountNumber: string;
  ifsc: string;
  /** Name on the candidate record — used only to flag name mismatches. */
  name?: string;
  verified?: boolean;
  onVerified: (result: BankVerificationResult) => void;
};

const normalise = (v: string) =>
  (v ?? "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Bank account verification during candidate onboarding. */
export function BankVerify({ accountNumber, ifsc, name, verified = false, onVerified }: Props) {
  const verify = useServerFn(verifyBankAccount);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const account = (accountNumber ?? "").replace(/\D/g, "");
  const code = (ifsc ?? "").trim().toUpperCase();
  const ready = /^\d{6,18}$/.test(account) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(code);
  const attemptedRef = useRef("");
  const key = `${account}|${code}`;

  const run = async () => {
    setBusy(true);
    setWarnings([]);
    try {
      const result = await verify({ data: { accountNumber: account, ifsc: code } });
      if (!result.verified) {
        toast.error(result.message || "Bank account could not be verified");
        setSummary(result.message);
        return;
      }

      const flags: string[] = [];
      if (name && result.full_name && normalise(name) !== normalise(result.full_name)) {
        flags.push(`Account holder differs from employee name (${result.full_name})`);
      }
      setWarnings(flags);
      setSummary([result.bank_name, result.branch, result.city].filter(Boolean).join(" · ") || result.message);
      onVerified(result);
      toast.success(flags.length ? "Bank account verified with warnings" : "Bank account verified — details filled in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bank verification failed");
    } finally {
      setBusy(false);
    }
  };

  // Verifies itself once a complete account number + IFSC pair is typed.
  useEffect(() => {
    if (!ready || verified || busy) return;
    if (attemptedRef.current === key) return;
    const timer = window.setTimeout(() => {
      attemptedRef.current = key;
      void run();
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, verified, busy]);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {verified ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Bank account verified</p>
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled={!ready || busy} onClick={() => void run()}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Landmark className="mr-1 h-3.5 w-3.5" />}
            {busy ? "Verifying account…" : attemptedRef.current === key ? "Retry bank check" : "Verify bank account"}
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          {summary ??
            (busy
              ? "Checking the account with the bank…"
              : ready
                ? "Verifies automatically — confirms the account exists and fills bank, branch and holder name."
                : "Enter the account number and IFSC — it verifies itself automatically.")}
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
