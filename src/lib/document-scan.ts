/**
 * Document scanning for attendance sheets — runs entirely in the browser.
 *
 * Pipeline: load → detect the paper quadrilateral → perspective-correct it →
 * flatten uneven lighting → sharpen. The same quality metrics drive the live
 * camera guidance ("hold steady", "move closer", "too dark"), so a photo and an
 * uploaded file are judged identically.
 */

export type ScanIssue =
  | "blurry"
  | "dark"
  | "bright"
  | "glare"
  | "far"
  | "cut_off"
  | "tilted"
  | "low_res"
  | "no_document";

export type ScanQuality = {
  /** 0-100 overall confidence that this image will read cleanly. */
  score: number;
  /** Laplacian variance, normalised. Higher = sharper. */
  sharpness: number;
  /** Mean luminance 0-255. */
  brightness: number;
  /** Share of near-white blown-out pixels 0-1. */
  glare: number;
  /** Share of the frame the sheet fills 0-1. */
  coverage: number;
  /** Longest/shortest edge ratio of the detected sheet. 1 = square on. */
  skew: number;
  issues: ScanIssue[];
  /** Single short instruction for the person holding the camera. */
  hint: string;
  verdict: "good" | "fair" | "poor";
};

export type ScanResult = {
  /** Cleaned, perspective-corrected JPEG data URL. */
  dataUrl: string;
  /** The untouched (only downscaled) source, so the user can fall back. */
  originalDataUrl: string;
  /** True when a paper outline was found and the image was cropped/straightened. */
  cropped: boolean;
  quality: ScanQuality;
  width: number;
  height: number;
};

const MAX_OUTPUT_DIM = 2200;

/* ------------------------------------------------------------------ loading */

export async function loadBitmap(src: File | Blob | string): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof src !== "string") {
    try {
      const bmp = await createImageBitmap(src);
      return bmp;
    } catch {
      /* fall through to <img> (Safari/HEIC) */
    }
  }
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read image"));
      i.src = url;
    });
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unsupported");
  return { canvas: c, ctx };
}

export function drawScaled(src: CanvasImageSource & { width: number; height: number }, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const { canvas, ctx } = makeCanvas(src.width * scale, src.height * scale);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* ------------------------------------------------------------- gray helpers */

type Gray = { data: Float32Array; w: number; h: number };

export function toGray(canvas: HTMLCanvasElement): Gray {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }
  return { data: out, w, h };
}

/** Variance of the Laplacian — the standard focus measure. */
function laplacianVariance(g: Gray): number {
  const { data, w, h } = g;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function otsu(g: Gray): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < g.data.length; i++) hist[Math.max(0, Math.min(255, g.data[i]! | 0))]! ++;
  const total = g.data.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

/* -------------------------------------------------------- quad detection */

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point]; // TL, TR, BR, BL

/**
 * Paper is the bright, large, connected blob in the frame. Threshold, keep the
 * biggest component, then take its extreme corners. Deliberately simple: a full
 * contour + Hough pipeline is far heavier and no more reliable on muster sheets
 * photographed on a desk.
 */
function detectQuad(g: Gray): { quad: Quad; coverage: number } | null {
  const { w, h } = g;
  const thr = Math.max(90, otsu(g) - 10);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = g.data[i]! >= thr ? 1 : 0;

  // Largest connected component (iterative flood fill, 4-connected).
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let bestPixels: number[] | null = null;
  let bestSize = 0;
  let current = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    let sp = 0;
    stack[sp++] = start;
    label[start] = current;
    const pixels: number[] = [];
    while (sp > 0) {
      const p = stack[--sp]!;
      pixels.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && label[p - 1] === -1) { label[p - 1] = current; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && label[p + 1] === -1) { label[p + 1] = current; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && label[p - w] === -1) { label[p - w] = current; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && label[p + w] === -1) { label[p + w] = current; stack[sp++] = p + w; }
    }
    if (pixels.length > bestSize) { bestSize = pixels.length; bestPixels = pixels; }
    current++;
  }
  if (!bestPixels || bestSize < w * h * 0.12) return null;

  let tl = 0, tr = 0, br = 0, bl = 0;
  let tlV = Infinity, trV = -Infinity, brV = -Infinity, blV = Infinity;
  for (const p of bestPixels) {
    const x = p % w;
    const y = (p - x) / w;
    const sum = x + y;
    const diff = x - y;
    if (sum < tlV) { tlV = sum; tl = p; }
    if (sum > brV) { brV = sum; br = p; }
    if (diff > trV) { trV = diff; tr = p; }
    if (diff < blV) { blV = diff; bl = p; }
  }
  const pt = (p: number): Point => ({ x: p % w, y: Math.floor(p / w) });
  const quad: Quad = [pt(tl), pt(tr), pt(br), pt(bl)];

  // Reject degenerate shapes (a thin bright strip, a blown-out background).
  const area = polyArea(quad);
  if (area < w * h * 0.12) return null;
  return { quad, coverage: bestSize / (w * h) };
}

function polyArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i]!;
    const n = q[(i + 1) % 4]!;
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------- perspective warp */

/** Solve the 8 homography coefficients mapping destination → source. */
function homography(dst: Quad, src: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const d = dst[i]!;
    const s = src[i]!;
    A.push([d.x, d.y, 1, 0, 0, 0, -d.x * s.x, -d.y * s.x]);
    b.push(s.x);
    A.push([0, 0, 0, d.x, d.y, 1, -d.x * s.y, -d.y * s.y]);
    b.push(s.y);
  }
  // Gaussian elimination with partial pivoting.
  const n = 8;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
    if (Math.abs(A[piv]![col]!) < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0];
    [A[col], A[piv]] = [A[piv]!, A[col]!];
    [b[col], b[piv]] = [b[piv]!, b[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r]![col]! / A[col]![col]!;
      if (!f) continue;
      for (let c = col; c < n; c++) A[r]![c] = A[r]![c]! - f * A[col]![c]!;
      b[r] = b[r]! - f * b[col]!;
    }
  }
  return A.map((row, i) => b[i]! / row[i]!);
}

function warp(source: HTMLCanvasElement, quad: Quad, outW: number, outH: number): HTMLCanvasElement {
  const [tl, tr, br, bl] = quad;
  const dst: Quad = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const H = homography(dst, [tl, tr, br, bl]);
  const sctx = source.getContext("2d", { willReadFrequently: true })!;
  const sImg = sctx.getImageData(0, 0, source.width, source.height);
  const { canvas, ctx } = makeCanvas(outW, outH);
  const out = ctx.createImageData(outW, outH);
  const sw = source.width;
  const sh = source.height;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const den = H[6]! * x + H[7]! * y + 1;
      const sx = (H[0]! * x + H[1]! * y + H[2]!) / den;
      const sy = (H[3]! * x + H[4]! * y + H[5]!) / den;
      const o = (y * outW + x) * 4;
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        out.data[o] = 255; out.data[o + 1] = 255; out.data[o + 2] = 255; out.data[o + 3] = 255;
        continue;
      }
      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const p00 = sImg.data[(y0 * sw + x0) * 4 + c]!;
        const p10 = sImg.data[(y0 * sw + x1) * 4 + c]!;
        const p01 = sImg.data[(y1 * sw + x0) * 4 + c]!;
        const p11 = sImg.data[(y1 * sw + x1) * 4 + c]!;
        out.data[o + c] = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------- enhancement */

/** Integral-image box blur of the luminance channel. */
function blurredLuma(img: ImageData, radius: number): Float32Array {
  const { width: w, height: h, data } = img;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rowSum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)]! + rowSum;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s =
        integral[(y1 + 1) * (w + 1) + (x1 + 1)]! -
        integral[y0 * (w + 1) + (x1 + 1)]! -
        integral[(y1 + 1) * (w + 1) + x0]! +
        integral[y0 * (w + 1) + x0]!;
      out[y * w + x] = s / area;
    }
  }
  return out;
}

/**
 * Flatten shadows (divide by the local background), stretch contrast, then a
 * light unsharp mask. Colour is kept so blue/red pen stays distinguishable.
 */
function enhance(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const bg = blurredLuma(img, Math.max(8, Math.round(Math.max(w, h) / 24)));

  const norm = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    const base = Math.max(24, bg[p]!);
    for (let c = 0; c < 3; c++) {
      norm[p * 3 + c] = Math.min(255, (img.data[p * 4 + c]! / base) * 210);
    }
  }
  // Percentile contrast stretch on luminance.
  const hist = new Array<number>(256).fill(0);
  for (let p = 0; p < w * h; p++) {
    const l = 0.299 * norm[p * 3]! + 0.587 * norm[p * 3 + 1]! + 0.114 * norm[p * 3 + 2]!;
    hist[Math.max(0, Math.min(255, l | 0))]!++;
  }
  const total = w * h;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let t = 0; t < 256; t++) { acc += hist[t]!; if (acc > total * 0.02) { lo = t; break; } }
  acc = 0;
  for (let t = 255; t >= 0; t--) { acc += hist[t]!; if (acc > total * 0.02) { hi = t; break; } }
  const span = Math.max(24, hi - lo);

  const stretched = new Float32Array(w * h * 3);
  for (let i = 0; i < norm.length; i++) {
    stretched[i] = Math.max(0, Math.min(255, ((norm[i]! - lo) / span) * 255));
  }
  // Unsharp mask using the luminance blur of the stretched image.
  const tmp = ctx.createImageData(w, h);
  for (let p = 0; p < w * h; p++) {
    tmp.data[p * 4] = stretched[p * 3]!;
    tmp.data[p * 4 + 1] = stretched[p * 3 + 1]!;
    tmp.data[p * 4 + 2] = stretched[p * 3 + 2]!;
    tmp.data[p * 4 + 3] = 255;
  }
  const soft = blurredLuma(tmp, 1);
  for (let p = 0; p < w * h; p++) {
    const l = 0.299 * stretched[p * 3]! + 0.587 * stretched[p * 3 + 1]! + 0.114 * stretched[p * 3 + 2]!;
    const boost = (l - soft[p]!) * 0.8;
    for (let c = 0; c < 3; c++) {
      tmp.data[p * 4 + c] = Math.max(0, Math.min(255, stretched[p * 3 + c]! + boost));
    }
  }
  ctx.putImageData(tmp, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------ quality/hints */

const HINTS: Record<ScanIssue, string> = {
  blurry: "Hold steady — the sheet looks blurred",
  dark: "Too dark — move to better light",
  bright: "Too bright — reduce the light",
  glare: "Glare on the sheet — tilt away from the light",
  far: "Move closer so the sheet fills the frame",
  cut_off: "Pull back a little — an edge is cut off",
  tilted: "Hold the camera square above the sheet",
  low_res: "Photo resolution is low — take a fresh photo",
  no_document: "Place the full sheet on a flat, contrasting surface",
};

const ISSUE_ORDER: ScanIssue[] = ["no_document", "blurry", "dark", "glare", "far", "cut_off", "bright", "tilted", "low_res"];

function assess(g: Gray, detected: { quad: Quad; coverage: number } | null, sourceMaxDim: number): ScanQuality {
  const issues: ScanIssue[] = [];
  let sum = 0;
  let glarePixels = 0;
  for (let i = 0; i < g.data.length; i++) {
    const v = g.data[i]!;
    sum += v;
    if (v > 250) glarePixels++;
  }
  const brightness = sum / g.data.length;
  const glare = glarePixels / g.data.length;
  // Normalise focus against image size so a big photo isn't unfairly penalised.
  const sharpness = laplacianVariance(g);

  if (sharpness < 120) issues.push("blurry");
  if (brightness < 70) issues.push("dark");
  if (brightness > 225) issues.push("bright");
  if (glare > 0.06) issues.push("glare");
  if (sourceMaxDim < 900) issues.push("low_res");

  let coverage = detected?.coverage ?? 0;
  let skew = 1;
  if (!detected) {
    issues.push("no_document");
  } else {
    if (coverage < 0.3) issues.push("far");
    if (coverage > 0.985) issues.push("cut_off");
    const [tl, tr, br, bl] = detected.quad;
    const top = dist(tl, tr);
    const bottom = dist(bl, br);
    const left = dist(tl, bl);
    const right = dist(tr, br);
    skew = Math.max(top / Math.max(1, bottom), bottom / Math.max(1, top), left / Math.max(1, right), right / Math.max(1, left));
    if (skew > 1.35) issues.push("tilted");
  }

  let score = 100;
  if (sharpness < 120) score -= 40;
  else if (sharpness < 260) score -= 15;
  if (brightness < 70 || brightness > 225) score -= 20;
  if (glare > 0.06) score -= 15;
  if (!detected) score -= 25;
  else if (coverage < 0.3) score -= 20;
  if (skew > 1.35) score -= 10;
  if (sourceMaxDim < 900) score -= 15;
  score = Math.max(0, Math.min(100, score));

  const primary = ISSUE_ORDER.find((i) => issues.includes(i));
  return {
    score,
    sharpness,
    brightness,
    glare,
    coverage,
    skew,
    issues,
    hint: primary ? HINTS[primary] : "Looks good — hold still",
    verdict: score >= 75 ? "good" : score >= 50 ? "fair" : "poor",
  };
}

/** Cheap check for the live camera preview (small frame, no warping). */
export function assessFrame(frame: HTMLCanvasElement): ScanQuality {
  const gray = toGray(frame);
  return assess(gray, detectQuad(gray), Math.max(frame.width, frame.height) * 3);
}

/* -------------------------------------------------------------- public API */

export async function scanDocument(
  src: File | Blob | string,
  opts: { enhance?: boolean; maxDim?: number } = {},
): Promise<ScanResult> {
  const bitmap = await loadBitmap(src);
  const maxDim = opts.maxDim ?? MAX_OUTPUT_DIM;
  const full = drawScaled(bitmap, maxDim);
  const originalDataUrl = full.toDataURL("image/jpeg", 0.92);

  // Detect on a small copy — fast, and edges survive downscaling.
  const small = drawScaled(full, 480);
  const smallGray = toGray(small);
  const detected = detectQuad(smallGray);
  const quality = assess(smallGray, detected, Math.max(bitmap.width, bitmap.height));

  let working = full;
  let cropped = false;
  if (detected && detected.coverage < 0.985 && detected.coverage > 0.2) {
    const scale = full.width / small.width;
    const quad = detected.quad.map((p) => ({ x: p.x * scale, y: p.y * scale })) as Quad;
    const [tl, tr, br, bl] = quad;
    const outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
    const outH = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
    if (outW > 200 && outH > 200) {
      const s = Math.min(1, maxDim / Math.max(outW, outH));
      working = warp(full, quad, Math.round(outW * s), Math.round(outH * s));
      cropped = true;
    }
  }
  if (opts.enhance !== false) working = enhance(working);

  return {
    dataUrl: working.toDataURL("image/jpeg", 0.94),
    originalDataUrl,
    cropped,
    quality,
    width: working.width,
    height: working.height,
  };
}

export function qualityTone(verdict: ScanQuality["verdict"]) {
  return verdict === "good"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : verdict === "fair"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-red-300 bg-red-50 text-red-800";
}
