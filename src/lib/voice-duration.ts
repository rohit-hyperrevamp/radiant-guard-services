/**
 * Parses spoken duration phrases like:
 *   "1 hour 30 minutes"      -> { hours: 1, minutes: 30 }
 *   "one and a half hours"   -> { hours: 1.5, minutes: 0 }
 *   "90 minutes"             -> { hours: 0, minutes: 90 }
 *   "half an hour"           -> { hours: 0, minutes: 30 }
 *   "two hours"              -> { hours: 2, minutes: 0 }
 *   "one thirty"             -> { hours: 1, minutes: 30 }
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
};

function normalizeWords(text: string): string {
  let out = ` ${text.toLowerCase()} `;
  // Common spoken fractions.
  out = out.replace(/half\s+an\s+hour|half\s+an?\s+hour|half\s+hour/, "0.5 hours");
  out = out.replace(/and\s+a\s+half|and\s+half|and\s+half/, " point five ");
  out = out.replace(/a\s+half|one\s+half/, " point five ");
  out = out.replace(/a\s+quarter/, " 0.25 ");
  out = out.replace(/\ban\b|\ba\b(?= (?:hour|hr))/, " 1 ");
  // Word numbers -> digits. Longer keys first so "sixty" wins over "six".
  const keys = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, "g"), WORD_NUMBERS[key]);
  }
  // Spoken decimal: "1 point five" -> "1.5", "one point three zero" -> "1.30".
  out = out.replace(/point\s+zero/gi, " point 0 ");
  out = out.replace(/point\s+five/gi, " point 5 ");
  out = out.replace(/(\d+)\s+point\s+(\d+(?:\s+\d)*)/g, (_m, a: string, b: string) => `${a}.${b.replace(/\s+/g, "")}`);
  return out;
}

export function parseDurationWords(text: string): ParsedDuration | null {
  const clean = normalizeWords(text);
  if (!clean.trim()) return null;

  const hourMatch = clean.match(/([\d.]+)\s*(?:hours?|hrs?|hr|ghanta|ghante|ghanta|ghnte)/);
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

  hours = Number.isFinite(hours) ? Math.max(0, Math.min(48, hours)) : 0;
  minutes = Number.isFinite(minutes) ? Math.max(0, Math.min(59, minutes)) : 0;
  if (hours === 0 && minutes === 0) return null;

  // Roll excessive minutes into hours (e.g. "90 minutes").
  if (minutes >= 60) {
    hours += Math.floor(minutes / 60);
    minutes = minutes % 60;
  }
  hours = Math.min(48, hours);
  if (hours === 48) minutes = 0;

  return { hours, minutes };
}
