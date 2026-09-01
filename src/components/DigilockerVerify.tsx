import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  getDigilockerProfile,
  startDigilockerSession,
  validateAadhaarNumber,
  type DigilockerProfile,
  type DigilockerSession,
} from "@/lib/surepass.functions";

type Props = {
  aadhaar: string;
  mobile?: string;
  verified?: boolean;
  onVerified: (profile: DigilockerProfile) => void;
};

/**
 * Aadhaar identity verification during candidate onboarding.
 * - "Validate" checks the Aadhaar number instantly (Surepass Aadhaar Validation).
 * - "DigiLocker" creates a consent link (shown as QR + link, optionally SMSed)
 *   and polls until the candidate finishes, then autofills verified details.
 */
export function DigilockerVerify({ aadhaar, mobile, verified = false, onVerified }: Props) {
  const validate = useServerFn(validateAadhaarNumber);
  const startSession = useServerFn(startDigilockerSession);
  const fetchProfile = useServerFn(getDigilockerProfile);

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<DigilockerSession | null>(null);
  const [qr, setQr] = useState<string>("");
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const verifiedAadhaarRef = useRef("");

  const clean = (aadhaar ?? "").replace(/\D/g, "");
  const ready = clean.length === 12;

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  /** Silent pre-check: the number must exist with UIDAI before we spend a DigiLocker consent link. */
  const runValidation = async (): Promise<boolean> => {
    setValidating(true);
    try {
      const result = await validate({ data: { aadhaar: clean } });
      setValidation(
        result.valid
          ? `Aadhaar valid · ${[result.state, result.age_range && `age ${result.age_range}`].filter(Boolean).join(" · ")}`.trim()
          : result.message,
      );
      if (!result.valid) toast.error(result.message || "Aadhaar could not be validated");
      if (result.valid) verifiedAadhaarRef.current = clean;
      return result.valid;
    } catch (error) {
      setValidation(null);
      toast.error(error instanceof Error ? error.message : "Aadhaar validation failed");
      return false;
    } finally {
      setValidating(false);
    }
  };

  const pullDetails = async (clientId: string, silent: boolean) => {
    try {
      const profile = await fetchProfile({ data: { clientId } });
      if (!profile.completed || !profile.full_name) {
        if (!silent) toast.info(profile.message || "Waiting for the candidate to finish DigiLocker");
        return false;
      }
      if (pollRef.current) window.clearInterval(pollRef.current);
      setPolling(false);
      setOpen(false);
      setError(null);
      onVerified({
        ...profile,
        aadhaar_number: /^\d{12}$/.test(profile.aadhaar_number)
          ? profile.aadhaar_number
          : verifiedAadhaarRef.current,
      });
      toast.success("DigiLocker verified — details filled in");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read DigiLocker status";
      setError(message);
      if (!silent) toast.error(message);
      return false;
    }
  };

  const beginPolling = (clientId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    setPolling(true);
    let ticks = 0;
    pollRef.current = window.setInterval(() => {
      ticks += 1;
      if (ticks > 75) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPolling(false);
        return;
      }
      void pullDetails(clientId, true);
    }, 4000);
  };

  const startDigilocker = async () => {
    if (!ready) {
      toast.error("Enter a 12-digit Aadhaar number first");
      return;
    }
    setStarting(true);
    const ok = await runValidation();
    if (!ok) {
      setStarting(false);
      return;
    }
    setSession(null);
    setQr("");
    setOpen(true);
    try {
      const digits = (mobile ?? "").replace(/\D/g, "");
      const created = await startSession({
        data: {
          redirectUrl: `${window.location.origin}/digilocker/callback`,
          aadhaar: verifiedAadhaarRef.current,
          ...(digits.length === 10 ? { mobile: digits } : {}),
          sendSms: digits.length === 10,
        },
      });
      setSession(created);
      try {
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(created.url, { width: 320, margin: 1 }));
      } catch {
        setQr("");
      }
      window.open(created.url, "_blank", "noopener,noreferrer");
      beginPolling(created.client_id);
    } catch (error) {
      setOpen(false);
      toast.error(error instanceof Error ? error.message : "Could not start DigiLocker");
    } finally {
      setStarting(false);
    }
  };

  const closePanel = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    setPolling(false);
    setOpen(false);
  };

  return (
    <div className="mt-2 space-y-3">
      {verified ? (
        <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <BadgeCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Aadhaar verified via DigiLocker</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!ready || starting || validating}
            onClick={() => void startDigilocker()}
          >
            {starting || validating ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            )}
            Verify via DigiLocker
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {validation ?? (ready ? "Checks the number with UIDAI, then opens DigiLocker consent." : "Enter all 12 digits to verify.")}
          </span>
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">DigiLocker verification</p>
              <p className="text-[11px] text-muted-foreground">
                The candidate scans the QR or opens the link and signs in to DigiLocker. Verified Aadhaar details fill in
                automatically once they finish.
              </p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={closePanel}>
              Close
            </Button>
          </div>

          {!session ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating secure link…
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {qr && <img src={qr} alt="DigiLocker consent QR code" className="mx-auto h-48 w-48 rounded-lg border bg-card" />}
              <a
                href={session.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1 break-all text-xs text-primary underline"
              >
                Open DigiLocker link <ExternalLink className="h-3 w-3" />
              </a>
              {(mobile ?? "").replace(/\D/g, "").length === 10 && (
                <p className="text-center text-[11px] text-muted-foreground">Link also sent by SMS to {mobile}</p>
              )}
              <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                {polling && <Loader2 className="h-3 w-3 animate-spin" />} Waiting for the candidate to complete…
              </p>
              {error && <p className="text-center text-[11px] text-destructive">{error}</p>}
              <div className="flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void pullDetails(session.client_id, false)}
                >
                  Fetch details now
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

