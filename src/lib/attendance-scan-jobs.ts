/**
 * Background attendance-sheet reading jobs.
 *
 * A sheet read keeps running after the upload dialog is closed. Progress, the
 * estimate and the remaining time are written to `attendance_scan_jobs` so the
 * attendance charter row can show "Reading 62% · ~20s left" from any screen.
 */
import { supabase } from "@/integrations/supabase/client";

export const SCAN_JOBS_QK = "attendance-scan-jobs";

const ESTIMATE_KEY = "attendance.scanEstimateSeconds.v2";
const DEFAULT_ESTIMATE_SECONDS = 35;
const STALE_AFTER_SECONDS = 150;

export type ScanJob = {
  id: string;
  unit_id: string;
  period_start: string;
  period_end: string;
  status: string;
  progress: number;
  eta_seconds: number | null;
  estimate_seconds: number | null;
  summary: string | null;
  error: string | null;
  started_at: string;
  heartbeat_at: string;
};

/** Rolling estimate from this browser's previous reads. */
export function readScanEstimateSeconds(): number {
  if (typeof window === "undefined") return DEFAULT_ESTIMATE_SECONDS;
  const raw = Number(window.localStorage.getItem(ESTIMATE_KEY));
  return Number.isFinite(raw) && raw >= 8 && raw <= 600 ? raw : DEFAULT_ESTIMATE_SECONDS;
}

export function recordScanDuration(seconds: number) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const prev = readScanEstimateSeconds();
  const blended = Math.round(prev * 0.6 + seconds * 0.4);
  window.localStorage.setItem(ESTIMATE_KEY, String(Math.min(600, Math.max(8, blended))));
}

export async function startScanJob(input: {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  kind: "image" | "excel";
  estimateSeconds: number;
}): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("attendance_scan_jobs" as never)
    .insert({
      unit_id: input.unitId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      kind: input.kind,
      status: "running",
      progress: 0,
      estimate_seconds: Math.round(input.estimateSeconds),
      eta_seconds: Math.round(input.estimateSeconds),
      created_by: auth.user?.id ?? null,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) return null;
  return (data as { id?: string } | null)?.id ?? null;
}

export async function heartbeatScanJob(id: string, progress: number, etaSeconds: number) {
  await supabase
    .from("attendance_scan_jobs" as never)
    .update({
      progress: Math.round(Math.min(99, Math.max(0, progress))),
      eta_seconds: Math.max(0, Math.round(etaSeconds)),
      heartbeat_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

export async function finishScanJob(id: string, summary: string) {
  await supabase
    .from("attendance_scan_jobs" as never)
    .update({
      status: "done",
      progress: 100,
      eta_seconds: 0,
      summary,
      heartbeat_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

export async function failScanJob(id: string, message: string) {
  await supabase
    .from("attendance_scan_jobs" as never)
    .update({
      status: "failed",
      error: message.slice(0, 400),
      heartbeat_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

/** Running jobs for the given units, keyed by unit. Stale jobs are ignored. */
export async function fetchRunningScanJobs(unitIds: string[]): Promise<Map<string, ScanJob>> {
  const out = new Map<string, ScanJob>();
  if (!unitIds.length) return out;
  const { data } = await supabase
    .from("attendance_scan_jobs" as never)
    .select(
      "id, unit_id, period_start, period_end, status, progress, eta_seconds, estimate_seconds, summary, error, started_at, heartbeat_at",
    )
    .in("unit_id", unitIds)
    .eq("status", "running")
    .order("heartbeat_at", { ascending: false });

  const cutoff = Date.now() - STALE_AFTER_SECONDS * 1000;
  for (const row of ((data ?? []) as unknown) as ScanJob[]) {
    if (new Date(row.heartbeat_at).getTime() < cutoff) continue;
    if (!out.has(row.unit_id)) out.set(row.unit_id, row);
  }
  return out;
}

export function formatRemaining(seconds: number | null | undefined) {
  if (seconds == null) return "calculating…";
  if (seconds <= 0) return "finishing…";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `~${s}s left`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `~${m}m ${String(rest).padStart(2, "0")}s left`;
}
