/**
 * Parses spoken duration phrases like:
 *   "1 hour 30 minutes"      -> { hours: 1, minutes: 30 }
 *   "one and a half hours"   -> { hours: 1.5, minutes: 0 }
 *   "90 minutes"             -> { hours: 1, minutes: 30 }
 *   "half an hour"           -> { hours: 0, minutes: 30 }
 *   "two hours"              -> { hours: 2, minutes: 0 }
 *   "one thirty"             -> { hours: 1, minutes: 30 }
 *   "ek ghanta tees minute"  -> { hours: 1, minutes: 30 }
 * Returns null when nothing duration-like is recognised.
 */
export interface ParsedDuration {
  hours: number;
  minutes: number;
}

const WORD_NUMBERS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fourty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  // Common Hindi/Hinglish numerals heard in speech.
  ek: "1",
  do: "2",
  teen: "3",
  char: "4",
  chaar: "4",
  paanch: "5",
  panch: "5",
  chhah: "6",
  cheh: "6",
  saat: "7",
  aath: "8",
  nau: "9",
  das: "10",
  bees: "20",
  tees: "30",
  chalis: "40",
  pachas: "50",
  saath: "7",
};

function normalizeWords(text: string): string {
  let out = ` ${text.toLowerCase()} `;
  // Standalone Hindi fraction words.
  out = out.replace(/\bdedh\b|\ddedh\b/g, "1.5");
  out = out.replace(/\bdhai\b/g, "2.5");
  out = out.replace(/\badha\b|\aadha\b/g, "0.5");
  // Spoken fractions using "half" — "and a half" must run before the
  // half-an-hour rule so "one and a half hours" is not eaten as "half hour".
  out = out.replace(/\band\s+a\s+half\b|\band\s+half\b|\ba\s+half\b|\bone\s+half\b/g, " point five ");
  out = out.replace(/\bhalf\s+(?:an\s+)?hours?\b/, "0.5 hours");
  // "sava two hours" -> 2.25, "paune two hours" -> 1.75.
  out = out.replace(/\bsava\s+(\d+(?:\.\d+)?)/g, (_m, n: string) => String(parseFloat(n) + 0.25));
  out = out.replace(/\bpaune\s+(\d+(?:\.\d+)?)/g, (_m, n: string) => String(Math.max(0, parseFloat(n) - 0.25)));
  // Word numbers -> digits. Longer keys first so "sixty" wins over "six".
  const keys = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, "g"), WORD_NUMBERS[key]);
  }
  out = out.replace(/\ban\b|\ba\b(?= (?:hour|hr))/, " 1 ");
  // Spoken decimal: "1 point five" -> "1.5", "one point three zero" -> "1.30".
  out = out.replace(/point\s+zero/gi, " point 0 ");
  out = out.replace(/point\s+five/gi, " point 5 ");
  out = out.replace(/(\d+)\s+point\s+(\d+(?:\s+\d)*)/g, (_m, a: string, b: string) => `${a}.${b.replace(/\s+/g, "")}`);
  return out;
}

export function parseDurationWords(text: string): ParsedDuration | null {
  const clean = normalizeWords(text);
  if (!clean.trim()) return null;

  const hourMatch = clean.match(/([\d.]+)\s*(?:hours?|hrs?|hr|ghanta|ghante|ghnte)/);
  const minuteMatch = clean.match(/([\d.]+)\s*(?:minutes?|mins?|min|minute|minit|minits)/);

  let hours = hourMatch ? parseFloat(hourMatch[1]) : 0;
  let minutes = minuteMatch ? parseFloat(minuteMatch[1]) : 0;

  if (hourMatch) {
    // A trailing bare number after the hours phrase, e.g. "1 hour 30".
    const after = clean.slice((hourMatch.index ?? 0) + hourMatch[0].length);
    if (!minuteMatch) {
      const bare = after.match(/([\d.]+)/);
      if (bare) {
        const v = parseFloat(bare[1]);
        if (Number.isFinite(v) && v > 0 && v <= 59) minutes = v;
      }
    }
  }

  if (!hourMatch && !minuteMatch) {
    // No unit words: "one thirty" -> 1h 30m; a single number up to 16 is
    // treated as hours, anything larger as minutes.
    const nums = clean.match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length === 0) return null;
    if (nums.length >= 2) {
      hours = parseFloat(nums[0]);
      minutes = parseFloat(nums[1]);
    } else {
      const v = parseFloat(nums[0]);
      if (v <= 16) hours = v;
      else minutes = v;
    }
  }

  hours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  minutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (hours === 0 && minutes === 0) return null;

  // Roll excessive minutes into hours (e.g. "90 minutes" -> 1h 30m).
  if (minutes >= 60) {
    hours += Math.floor(minutes / 60);
    minutes = minutes % 60;
  }
  hours = Math.max(0, Math.min(48, hours));
  minutes = Math.max(0, Math.min(59, minutes));
  if (hours === 48) minutes = 0;

  return { hours, minutes };
}
