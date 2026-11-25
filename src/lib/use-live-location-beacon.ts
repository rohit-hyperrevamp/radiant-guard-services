import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from '@/lib/use-me';
import { trackingEligible, usableLocationFix } from '@/lib/work-location';
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { fetchTodayPunch, pushTelemetry, readBattery, readNetworkType, distanceMeters } from "@/lib/self-attendance";
import { insertTrackPoint } from "@/lib/field-visits";
import { REALTIME_THROTTLE_MS } from "@/lib/dashboard-realtime";

/** How often (ms) we push the officer's position while on duty. */
const BEACON_INTERVAL_MS = 30_000; // twice a minute
/** Minimum movement (m) before a new track point is stored. */
const MIN_MOVE_METERS = 25;
/** Re-check the punch state at this cadence so check-in/out is picked up without a reload. */
const PUNCH_POLL_MS = 60_000;

type Last = { lat: number; lng: number; at: number } | null;

/**
 * Foreground live-location beacon for field officers and transport drivers.
 *
 * Mounted once in the admin layout: while the signed-in employee is on
 * duty (checked in, not checked out), their position is streamed to
 * `self_attendance_punches` telemetry on every screen — not only on Radar —
 * so viewers with Radar access see them move in real time. Track points are
 * appended when they actually move, keeping the day's trail meaningful.
 */
export function useLiveLocationBeacon() {
  const { candidateId, roleKey } = useCurrentUserRole();
  const me = useMe();
  const eligible = trackingEligible(roleKey, me.designation);
  const punchRef = useRef<{ id: string; onDuty: boolean } | null>(null);
  const lastRef = useRef<Last>(null);

  useEffect(() => {
    if (!eligible || !candidateId) return;
    const employeeId = candidateId;
    punchRef.current = null; lastRef.current = null;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    let watchId: number | null = null;
    let pushTimer: number | null = null;
    let punchTimer: number | null = null;
    let current: { lat: number; lng: number; accuracy: number | null; timestamp: number } | null = null;
    let flushing = false;
    let lastPushedAt = 0;

    async function refreshPunch() {
      try {
        const punch = await fetchTodayPunch(employeeId);
        if (cancelled) return;
        punchRef.current = punch
          ? { id: punch.id, onDuty: !!punch.check_in_at && !punch.check_out_at }
          : null;
      } catch {
        /* keep the last known punch state */
      }
    }

    async function flush() {
      const punch = punchRef.current;
      if (cancelled || flushing || Date.now() - lastPushedAt < BEACON_INTERVAL_MS || !punch?.onDuty || !current || !usableLocationFix(current.timestamp, current.accuracy)) return;
      flushing = true;
      const geo = { lat: current.lat, lng: current.lng, accuracy: current.accuracy ?? 0 };
      try {
        const [battery, network] = await Promise.all([readBattery(), readNetworkType()]);
        if (cancelled) { flushing = false; return; }
        await pushTelemetry(punch.id, { geo, battery, network });
        lastPushedAt = Date.now();
      } catch {
        /* telemetry is best-effort */
      }
      const prev = lastRef.current;
      const moved = prev ? distanceMeters(prev, geo) : null;
      const precise = geo.accuracy == null || geo.accuracy === 0 || geo.accuracy <= 100;
      if (roleKey === "field_officer" && precise && (!prev || (moved != null && moved >= MIN_MOVE_METERS))) {
        try {
          await insertTrackPoint({
            candidateId: employeeId,
            lat: geo.lat,
            lng: geo.lng,
            accuracy: geo.accuracy,
            visitId: null,
          });
          // Only advance the anchor once a point is stored, so slow steady
          // movement still accumulates into a trail instead of being skipped.
          lastRef.current = { lat: geo.lat, lng: geo.lng, at: Date.now() };
        } catch {
          /* trail write is best-effort */
        }
      }
      flushing = false;
    }

    void refreshPunch();
    punchTimer = window.setInterval(() => void refreshPunch(), PUNCH_POLL_MS);

    watchId = navigator.geolocation.watchPosition(
      (p) => {
        current = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null, timestamp: p.timestamp };
        void flush();
      },
      () => { /* permission denied or unavailable — stay silent */ },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    pushTimer = window.setInterval(() => void flush(), BEACON_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshPunch();
        void flush();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (pushTimer) window.clearInterval(pushTimer);
      if (punchTimer) window.clearInterval(punchTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [candidateId, eligible, roleKey]);
}

/** Live punch screens refresh no faster than this. */
export const LIVE_PUNCH_POLL_MIN_MS = 30_000;

/**
 * Run `onChange` every `intervalMs` (never faster than 30 s) while the tab is
 * visible, plus once when it becomes visible again. self_attendance_punches is
 * no longer in the realtime publication (every on-duty beacon writes a row
 * about every 30 s — a high-volume per-row stream), so screens poll instead.
 * Returns the cleanup function, like the old subscription helper.
 */
export function subscribeLivePunches(onChange: () => void, intervalMs: number = REALTIME_THROTTLE_MS) {
  const every = Math.max(LIVE_PUNCH_POLL_MIN_MS, intervalMs);
  if (typeof window === "undefined") return () => {};
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
  const timer = window.setInterval(() => {
    if (visible()) onChange();
  }, every);
  const onVisible = () => {
    if (visible()) onChange();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  };
}
