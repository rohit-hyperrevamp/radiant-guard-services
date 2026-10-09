// Payroll only lists people who have attendance in the period, so a deduction
// added to someone without attendance (often a duplicate employee record with
// the same name) silently never shows. These helpers let the deduction form and
// the payroll register spot that and point to the right person.

import { supabase } from "@/integrations/supabase/client";

const CHUNK = 150;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Number of attendance days per candidate between from and to (inclusive). */
export async function attendanceCountByCandidate(args: {
  candidateIds: string[];
  from: string;
  to: string;
  unitId?: string | null;
}): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = Array.from(new Set(args.candidateIds.filter(Boolean)));
  for (const id of ids) counts.set(id, 0);
  for (const part of chunks(ids, 40)) {
    for (let from = 0; ; from += 1000) {
      let q = supabase
        .from("attendance_entries")
        .select("candidate_id")
        .in("candidate_id", part)
        .gte("entry_date", args.from)
        .lte("entry_date", args.to)
        .range(from, from + 999);
      if (args.unitId) q = q.eq("unit_id", args.unitId);
      const { data, error } = await q;
      if (error) throw error;
      for (const r of (data ?? []) as { candidate_id: string }[]) {
        counts.set(r.candidate_id, (counts.get(r.candidate_id) ?? 0) + 1);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return counts;
}

function tokens(name: string | null | undefined): string[] {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** True when two names look like the same person (e.g. "Ravi Shirpurkar" vs "Ravi Vinod Shirpurkar"). */
export function namesLookAlike(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  const needed = Math.min(2, Math.min(ta.length, tb.length));
  return shared >= needed;
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export { chunks as chunkIds };
