import { supabase } from "@/integrations/supabase/client";
import { capturePhoto } from "@/lib/native-camera";
import type { Geo } from "@/lib/self-attendance";

export const SELFIE_BUCKET = "attendance-selfies";

export async function reversePlace(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      { headers: { "Accept-Language": "en" } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { display_name?: string };
    return j.display_name?.split(",").slice(0, 5).join(",").trim() ?? null;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/** Burns a GPS stamp (place, lat/long, accuracy, time, name) into the photo. */
async function stamp(dataUrl: string, info: { name: string; action: string; geo: Geo; place: string | null; at: Date }): Promise<Blob> {
  const img = await loadImage(dataUrl);
  // Attendance photos are identity thumbnails, not documents. Keep them tiny
  // so mobile uploads are fast and long-term private storage stays economical.
  const maxW = 420;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  const fs = Math.max(11, Math.round(w / 38));
  const pad = Math.round(fs * 0.8);
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  const place = wrap(ctx, info.place ?? "Location name unavailable", w - pad * 2);
  const lines = [
    `${info.action} · ${info.name}`,
    ...place,
    `Lat ${info.geo.lat.toFixed(6)}  Long ${info.geo.lng.toFixed(6)}  ±${Math.round(info.geo.accuracy ?? 0)}m`,
    info.at.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" }) + " IST",
  ];
  const lh = Math.round(fs * 1.35);
  const boxH = lines.length * lh + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = "#ffffff";
  lines.forEach((l, i) => {
    ctx.font = `${i === 0 ? 800 : 600} ${fs}px system-ui, sans-serif`;
    ctx.fillText(l, pad, h - boxH + pad + lh * (i + 0.8));
  });
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not save photo."))), "image/jpeg", 0.38),
  );
}

/** Opens the front camera, stamps GPS + time, uploads. Mandatory — throws when cancelled. */
export async function captureAttendanceSelfie(opts: {
  candidateId: string;
  name: string;
  action: "in" | "out";
  geo: Geo;
}): Promise<{ path: string; place: string | null }> {
  const label = opts.action === "in" ? "Log in" : "Log out";
  const [photo, place] = await Promise.all([
    capturePhoto({ front: true, title: `Face scan · ${label}` }),
    reversePlace(opts.geo.lat, opts.geo.lng),
  ]);
  if (!photo) throw new Error("A face photo is required to mark attendance. Please take the photo.");
  const at = new Date();
  const blob = await stamp(photo, { name: opts.name, action: label, geo: opts.geo, place, at });
  const d = at.toISOString().slice(0, 10);
  const path = `${opts.candidateId}/${d}/${opts.action}-${at.getTime()}.jpg`;
  const { error } = await supabase.storage.from(SELFIE_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return { path, place };
}

export async function selfieUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(SELFIE_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
