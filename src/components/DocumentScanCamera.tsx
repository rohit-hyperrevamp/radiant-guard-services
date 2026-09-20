/**
 * Live document scanner for attendance sheets.
 *
 * Shows the camera with a framing guide and real-time coaching ("hold steady",
 * "move closer", "too dark"). When three consecutive frames read clean it
 * captures automatically, then perspective-corrects and cleans the shot before
 * handing it back. Manual capture is always available.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assessFrame, scanDocument, type ScanQuality, type ScanResult } from "@/lib/document-scan";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with every accepted scan. Multiple pages can be captured in a row. */
  onCapture: (pages: Array<{ name: string; dataUrl: string; scan: ScanResult }>) => void;
  title?: string;
};

const GOOD_FRAMES_TO_AUTOCAPTURE = 3;

export function DocumentScanCamera({ open, onOpenChange, onCapture, title = "Scan attendance sheet" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const goodStreakRef = useRef(0);
  const busyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<ScanQuality | null>(null);
  const [autoCapture, setAutoCapture] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [shot, setShot] = useState<ScanResult | null>(null);
  const [pages, setPages] = useState<Array<{ name: string; dataUrl: string; scan: ScanResult }>>([]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || !video.videoWidth) return;
    busyRef.current = true;
    setProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", 0.95),
      );
      const result = await scanDocument(blob);
      setShot(result);
      stop();
    } catch {
      setError("Could not capture the photo. Try again.");
    } finally {
      setProcessing(false);
      busyRef.current = false;
      goodStreakRef.current = 0;
    }
  }, [stop]);

  const start = useCallback(async () => {
    setError(null);
    setShot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setReady(true);
    } catch {
      setError("Camera unavailable. Allow camera access, or upload a photo instead.");
    }
  }, []);

  // Open/close lifecycle.
  useEffect(() => {
    if (open) void start();
    else {
      stop();
      setShot(null);
      setPages([]);
      setQuality(null);
    }
    return () => stop();
  }, [open, start, stop]);

  // Live coaching loop.
  useEffect(() => {
    if (!open || !ready || shot) return;
    let cancelled = false;
    const sample = document.createElement("canvas");
    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.videoWidth && !busyRef.current) {
        const scale = 320 / Math.max(video.videoWidth, video.videoHeight);
        sample.width = Math.round(video.videoWidth * scale);
        sample.height = Math.round(video.videoHeight * scale);
        const ctx = sample.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, sample.width, sample.height);
          try {
            const q = assessFrame(sample);
            setQuality(q);
            if (q.verdict === "good") goodStreakRef.current += 1;
            else goodStreakRef.current = 0;
            if (autoCapture && goodStreakRef.current >= GOOD_FRAMES_TO_AUTOCAPTURE) {
              goodStreakRef.current = 0;
              void capture();
            }
          } catch {
            /* frame skipped */
          }
        }
      }
      timer = window.setTimeout(tick, 450);
    };
    let timer = window.setTimeout(tick, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, ready, shot, autoCapture, capture]);

  const acceptShot = (addAnother: boolean) => {
    if (!shot) return;
    const next = [
      ...pages,
      { name: `scan-${pages.length + 1}.jpg`, dataUrl: shot.dataUrl, scan: shot },
    ];
    setPages(next);
    setShot(null);
    if (addAnother) void start();
    else {
      onCapture(next);
      onOpenChange(false);
    }
  };

  const frameTone =
    quality?.verdict === "good"
      ? "border-emerald-400"
      : quality?.verdict === "fair"
        ? "border-amber-400"
        : "border-red-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Place the sheet on a flat surface. Keep all four edges inside the frame — it captures on its own once clear.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        ) : null}

        {shot ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
              <img src={shot.dataUrl} alt="Scanned sheet" className="max-h-[22rem] w-full object-contain" />
            </div>
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                shot.quality.verdict === "good"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : shot.quality.verdict === "fair"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-red-200 bg-red-50 text-red-800",
              )}
            >
              {shot.cropped ? "Edges detected, straightened and cleaned. " : "Cleaned. Sheet edges were not detected. "}
              {shot.quality.verdict === "good" ? "Quality looks good." : shot.quality.hint}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShot(null); void start(); }}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Retake
              </Button>
              <Button variant="outline" onClick={() => acceptShot(true)}>Use &amp; scan next page</Button>
              <Button onClick={() => acceptShot(false)}>
                <Check className="mr-1.5 h-4 w-4" /> Use {pages.length ? `${pages.length + 1} pages` : "this scan"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} playsInline muted className="h-[20rem] w-full object-contain" />
              <div className={cn("pointer-events-none absolute inset-4 rounded-md border-2 border-dashed transition-colors", frameTone)} />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-3 py-2 text-xs text-white">
                <span className="flex items-center gap-2">
                  {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {processing ? "Processing scan…" : (quality?.hint ?? "Starting camera…")}
                </span>
                <span className="tabular-nums opacity-80">{quality ? `${quality.score}%` : ""}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={autoCapture} onChange={(e) => setAutoCapture(e.target.checked)} />
                Capture automatically when clear
              </label>
              <div className="flex gap-2">
                {pages.length ? (
                  <Button variant="outline" onClick={() => { onCapture(pages); onOpenChange(false); }}>
                    Done ({pages.length})
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  <X className="mr-1.5 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={() => void capture()} disabled={!ready || processing}>
                  <Camera className="mr-1.5 h-4 w-4" /> Capture now
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
