/**
 * Resilient file uploads for the mobile app.
 *
 * On Android/iOS WebViews a file picked through `<input type="file">` is backed
 * by a `content://` URI. Streaming that File straight into `fetch` frequently
 * dies mid-request ("Failed to fetch") because the WebView loses the handle.
 * Reading the bytes into memory first, shrinking oversized photos and retrying
 * transient network errors makes onboarding uploads dependable on phones.
 */

const MAX_IMAGE_EDGE = 2200;
const IMAGE_QUALITY = 0.86;

/** Reads the picked file fully into memory so the upload never streams a lost handle. */
async function materialize(file: File): Promise<Blob> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error("Could not read the selected file"));
    reader.onerror = () => reject(new Error("Could not read the selected file. Try again."));
    reader.readAsArrayBuffer(file);
  });
  if (buffer.byteLength === 0) throw new Error("The selected file is empty. Pick it again.");
  return new Blob([buffer], { type: file.type || "application/octet-stream" });
}

/** Shrinks very large photos so slow mobile connections can finish the upload. */
async function shrinkImage(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/") || typeof document === "undefined") return blob;
  try {
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!longest || longest <= MAX_IMAGE_EDGE) {
      URL.revokeObjectURL(url);
      return blob;
    }
    const scale = MAX_IMAGE_EDGE / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const out: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", IMAGE_QUALITY),
    );
    return out && out.size > 0 ? out : blob;
  } catch {
    return blob;
  }
}

function isNetworkFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|network|load failed|timeout|aborted|connection/i.test(msg);
}

/** Prepares a picked file for upload: in-memory bytes, sensible size, correct extension. */
export async function prepareUpload(file: File): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const raw = await materialize(file);
  const blob = await shrinkImage(raw);
  const contentType = blob.type || file.type || "application/octet-stream";
  const nameExt = (file.name.split(".").pop() || "").toLowerCase();
  const ext =
    contentType === "application/pdf"
      ? "pdf"
      : blob !== raw
        ? "jpg"
        : /^[a-z0-9]{2,5}$/.test(nameExt)
          ? nameExt
          : contentType.startsWith("image/")
            ? "jpg"
            : "bin";
  return { blob, ext, contentType };
}

/** Runs an upload, retrying twice when the mobile connection drops mid-request. */
export async function withUploadRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (!isNetworkFailure(err)) throw err;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw new Error(
    isNetworkFailure(lastError)
      ? "Upload could not reach the server. Check your internet connection and try again."
      : lastError instanceof Error
        ? lastError.message
        : "Upload failed",
  );
}
