import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onVerified: (profile: DigilockerProfile) => void;
};

/**
 * Aadhaar identity verification during candidate onboarding.
 * - "Validate" checks the Aadhaar number instantly (Surepass Aadhaar Validation).
 * - "DigiLocker" creates a consent link (shown as QR + link, optionally SMSed)
 *   and polls until the candidate finishes, then autofills verified details.
 */
export function DigilockerVerify({ aadhaar, mobile, onVerified }: Props) {
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
  const pollRef = useRef<number | null>(null);

  const clean = (aadhaar ?? "").replace(/\D/g, "");
  const ready = clean.length === 12;

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const runValidation = async () => {
    if (!ready) {
      toast.error("Enter a 12-digit Aadhaar number first");
      return;
    }
    setValidating(true);
    try {
      const result = await validate({ data: { aadhaar: clean } });
      setValidation(
        result.valid
          ? `Valid · ${[result.state, result.age_range && `age ${result.age_range}`].filter(Boolean).join(" · ")}`.trim()
          : result.message,
      );
      if (result.valid) toast.success("Aadhaar number validated");
      else toast.error(result.message || "Aadhaar could not be validated");
    } catch (error) {
      setValidation(null);
      toast.error(error instanceof Error ? error.message : "Aadhaar validation failed");
    } finally {
      setValidating(false);
    }
  };

  const beginPolling = (clientId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    setPolling(true);
    pollRef.current = window.setInterval(async () => {
      try {
        const profile = await fetchProfile({ data: { clientId } });
        if (!profile.completed) return;
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPolling(false);
        setOpen(false);
        onVerified(profile);
        toast.success("DigiLocker verified — details filled in");
      } catch (error) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPolling(false);
        toast.error(error instanceof Error ? error.message : "Could not read DigiLocker status");
      }
    }, 4000);
  };

  const startDigilocker = async () => {
    setStarting(true);
    setSession(null);
    setQr("");
    setOpen(true);
    try {
      const digits = (mobile ?? "").replace(/\D/g, "");
      const created = await startSession({
        data: {
          redirectUrl: `${window.location.origin}/digilocker/callback`,
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
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!ready || validating} onClick={runValidation}>
          {validating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="mr-1 h-3.5 w-3.5" />}
          Validate Aadhaar
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={starting} onClick={() => void startDigilocker()}>
          {starting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
          Verify via DigiLocker
        </Button>
        {validation && <span className="text-[11px] text-muted-foreground">{validation}</span>}
      </div>

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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

