import { memo, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * List avatar that only ever shows the small 128px thumbnail.
 * Original photos are 1–4 MB each; drawing them as 32px circles made the
 * Employees list download tens of MB per page and stutter while scrolling.
 * When a person has a photo but no thumbnail yet (new upload / import), one
 * is made in the background once and saved for everyone.
 */
const THUMB = 128;
const queue: Array<() => Promise<void>> = [];
const pending = new Map<string, Promise<string | null>>();
let running = 0;

function pump() {
  while (running < 2 && queue.length) {
    const job = queue.shift()!;
    running++;
    void job().finally(() => {
      running--;
      pump();
    });
  }
}

async function makeThumb(candidateId: string, photoUrl: string): Promise<string | null> {
  const res = await fetch(photoUrl);
  if (!res.ok) return null;
  const bitmap = await createImageBitmap(await res.blob());
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = Math.max(0, (bitmap.height - side) * 0.35);
  const canvas = document.createElement("canvas");
  canvas.width = THUMB;
  canvas.height = THUMB;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, THUMB, THUMB);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.72));
  if (!blob) return null;
  const path = `thumb/${candidateId}-${Date.now()}.jpg`;
  const up = await supabase.storage
    .from("candidate-files")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (up.error) return null;
  const { data } = await supabase.storage
    .from("candidate-files")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  const url = data?.signedUrl ?? null;
  if (url) {
    await supabase
      .from("candidates" as never)
      .update({ photo_thumb_url: url } as never)
      .eq("id", candidateId);
  }
  return url;
}

function ensureThumb(candidateId: string, photoUrl: string): Promise<string | null> {
  const existing = pending.get(candidateId);
  if (existing) return existing;
  const p = new Promise<string | null>((resolve) => {
    queue.push(() =>
      makeThumb(candidateId, photoUrl)
        .then(resolve)
        .catch(() => resolve(null)),
    );
    pump();
  });
  pending.set(candidateId, p);
  return p;
}

export const EmployeeAvatar = memo(function EmployeeAvatar({
  id,
  photoUrl,
  thumbUrl,
  className,
}: {
  id: string;
  photoUrl?: string | null;
  thumbUrl?: string | null;
  className?: string;
}) {
  const [made, setMade] = useState<string | null>(null);
  const src = thumbUrl || made;
  useEffect(() => {
    if (src || !photoUrl) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void ensureThumb(id, photoUrl).then((u) => alive && u && setMade(u));
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [id, photoUrl, src]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={THUMB}
        height={THUMB}
        loading="lazy"
        decoding="async"
        className={cn("flex-shrink-0 rounded-full bg-secondary object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground",
        className,
      )}
    >
      <UserPlus className="h-3.5 w-3.5" />
    </div>
  );
});
