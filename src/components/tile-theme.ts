/**
 * Shared tile design language — mirrors the dashboard metric tiles so every
 * KPI/stat tile across the platform reads the same way:
 * calm white surface, quiet label, crisp numeral, small tinted icon chip.
 */
export type Accent =
  | "rose"
  | "cyan"
  | "lime"
  | "violet"
  | "amber"
  | "emerald"
  | "sky"
  | "indigo";

export const ACCENTS: Accent[] = [
  "rose",
  "cyan",
  "amber",
  "lime",
  "violet",
  "emerald",
  "sky",
  "indigo",
];

/** Tile surfaces — one calm white card for every tile; colour lives only in the
 *  small icon chip and in semantic figures (good / attention / problem). */
const NEUTRAL_TILE = "bg-card border-border/70 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-18px_rgb(15_23_42/0.18)] dark:bg-card";
export const ACCENT_TILE_BG: Record<Accent, string> = {
  rose: NEUTRAL_TILE,
  cyan: NEUTRAL_TILE,
  lime: NEUTRAL_TILE,
  violet: NEUTRAL_TILE,
  amber: NEUTRAL_TILE,
  emerald: NEUTRAL_TILE,
  sky: NEUTRAL_TILE,
  indigo: NEUTRAL_TILE,
};

/** Icon chips — soft tinted discs with a coloured glyph. */
export const ACCENT_CHIP: Record<Accent, string> = {
  rose: "bg-rose-500/10 text-rose-600 ring-rose-500/15 dark:bg-rose-400/15 dark:text-rose-300 dark:ring-rose-300/20",
  cyan: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/15 dark:bg-cyan-400/15 dark:text-cyan-300 dark:ring-cyan-300/20",
  lime: "bg-lime-500/12 text-lime-700 ring-lime-500/20 dark:bg-lime-400/15 dark:text-lime-300 dark:ring-lime-300/20",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/15 dark:bg-violet-400/15 dark:text-violet-300 dark:ring-violet-300/20",
  amber: "bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-300/20",
  emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-300/20",
  sky: "bg-brand/10 text-brand ring-brand/20 dark:bg-brand/20 dark:text-white dark:ring-brand/30",
  indigo: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15 dark:bg-indigo-400/15 dark:text-indigo-300 dark:ring-indigo-300/20",
};

/** Stable accent derived from a tile label, so colours stay consistent per page. */
export function accentFromKey(key: string): Accent {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/** Map semantic tones used by older stat components onto the tile palette. */
export function accentFromTone(
  tone?: "default" | "accent" | "success" | "warning" | "destructive",
): Accent | null {
  switch (tone) {
    case "success":
      return "emerald";
    case "warning":
      return "amber";
    case "destructive":
      return "rose";
    case "accent":
      return "sky";
    default:
      return null;
  }
}
