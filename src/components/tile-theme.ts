/**
 * Shared tile design language — mirrors the dashboard metric tiles so every
 * KPI/stat tile across the platform reads the same way:
 * vivid accent surface, quiet label, oversized numeral, solid accent icon chip.
 *
 * Palette pairs the Radiant brand blue with saturated corporate accents so the
 * interior feels alive instead of washed out.
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

/** Tile surfaces — noticeably richer than plain pastels, still corporate. */
export const ACCENT_TILE_BG: Record<Accent, string> = {
  rose: "bg-rose-200/60 dark:bg-rose-500/20",
  cyan: "bg-cyan-200/60 dark:bg-cyan-500/20",
  lime: "bg-lime-200/70 dark:bg-lime-500/20",
  violet: "bg-violet-200/60 dark:bg-violet-500/20",
  amber: "bg-amber-200/70 dark:bg-amber-500/20",
  emerald: "bg-emerald-200/60 dark:bg-emerald-500/20",
  /* Brand blue — the Radiant identity colour, used for headline tiles. */
  sky: "bg-brand/12 dark:bg-brand/25",
  indigo: "bg-indigo-200/60 dark:bg-indigo-500/20",
};

/** Icon chips — solid accent discs with white glyphs for real contrast. */
export const ACCENT_CHIP: Record<Accent, string> = {
  rose: "bg-rose-500 text-white ring-rose-600/30 dark:bg-rose-400 dark:text-rose-950 dark:ring-rose-300/30",
  cyan: "bg-cyan-600 text-white ring-cyan-700/30 dark:bg-cyan-400 dark:text-cyan-950 dark:ring-cyan-300/30",
  lime: "bg-lime-600 text-white ring-lime-700/30 dark:bg-lime-400 dark:text-lime-950 dark:ring-lime-300/30",
  violet:
    "bg-violet-500 text-white ring-violet-600/30 dark:bg-violet-400 dark:text-violet-950 dark:ring-violet-300/30",
  amber:
    "bg-amber-500 text-white ring-amber-600/30 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-300/30",
  emerald:
    "bg-emerald-600 text-white ring-emerald-700/30 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-300/30",
  sky: "bg-brand text-white ring-brand/30 dark:bg-brand dark:text-white dark:ring-brand/40",
  indigo:
    "bg-indigo-500 text-white ring-indigo-600/30 dark:bg-indigo-400 dark:text-indigo-950 dark:ring-indigo-300/30",
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
