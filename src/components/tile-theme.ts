/**
 * Shared tile design language — mirrors the dashboard metric tiles so every
 * KPI/stat tile across the platform reads the same way:
 * vivid gradient surface with glow, quiet label, crisp numeral, gradient icon disc.
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

/** Tile surfaces — vivid gradient tiles with a coloured glow (see .tile-aurora). */
export const ACCENT_TILE_BG: Record<Accent, string> = {
  rose: "tile-aurora tile-c-rose",
  cyan: "tile-aurora tile-c-cyan",
  lime: "tile-aurora tile-c-lime",
  violet: "tile-aurora tile-c-violet",
  amber: "tile-aurora tile-c-amber",
  emerald: "tile-aurora tile-c-emerald",
  sky: "tile-aurora tile-c-sky",
  indigo: "tile-aurora tile-c-indigo",
};

/** Icon chips — solid gradient discs with white glyphs. */
export const ACCENT_CHIP: Record<Accent, string> = {
  rose: "chip-grad tile-c-rose",
  cyan: "chip-grad tile-c-cyan",
  lime: "chip-grad tile-c-lime",
  violet: "chip-grad tile-c-violet",
  amber: "chip-grad tile-c-amber",
  emerald: "chip-grad tile-c-emerald",
  sky: "chip-grad tile-c-sky",
  indigo: "chip-grad tile-c-indigo",
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
