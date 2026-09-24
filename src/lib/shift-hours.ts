import { supabase } from "@/integrations/supabase/client";
import { fetchPostingShifts } from "@/lib/shift-resources";

/**
 * Contractual shift hours (8h or 12h) are the foundational layer for
 * attendance + overtime. They are defined per contract resource line
 * (unit x designation) on active client contracts.
 *
 * Rules derived from the shift length S:
 *  - worked < S/2      -> Absent (A)
 *  - S/2 <= worked < S -> Half Day (HD)
 *  - worked >= S       -> Present (P)
 *  - OT hours          -> max(0, worked - S), expressed in OT days as OT/S
 */
export const DEFAULT_SHIFT_HOURS = 8;

export type ShiftHoursMap = {
  /** `${unitId}|${designationId}` -> hours */
  byUnitDesignation: Map<string, number>;
  /** unitId -> most common shift hours on that unit */
  byUnit: Map<string, number>;
  /** `${unitId}|${candidateId}` -> duty length set on the guard's posting. */
  byCandidateUnit?: Map<string, number>;
  /** `${unitId}|${designationId}` -> duty lengths the contract offers. */
  offered?: Map<string, Set<number>>;
};

export function shiftHoursFor(
  map: ShiftHoursMap | null | undefined,
  unitId: string | null | undefined,
  designationId: string | null | undefined,
  candidateId?: string | null,
): number {
  if (!map || !unitId) return DEFAULT_SHIFT_HOURS;
  if (candidateId) {
    const posted = map.byCandidateUnit?.get(`${unitId}|${candidateId}`);
    const offered = designationId ? map.offered?.get(`${unitId}|${designationId}`) : undefined;
    // Posting wins when the contract offers that length (or has no line for the designation).
    if (posted && (!offered || offered.has(posted))) return posted;
  }
  if (designationId) {
    const exact = map.byUnitDesignation.get(`${unitId}|${designationId}`);
    if (exact) return exact;
  }
  return map.byUnit.get(unitId) ?? DEFAULT_SHIFT_HOURS;
}

function normalize(hours: unknown): number {
  const n = Number(hours);
  return n === 12 ? 12 : DEFAULT_SHIFT_HOURS;
}

export async function fetchShiftHoursMap(unitIds: string[]): Promise<ShiftHoursMap> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  const empty: ShiftHoursMap = { byUnitDesignation: new Map(), byUnit: new Map() };
  if (!ids.length) return empty;

  const { data: contracts, error: cErr } = await supabase
    .from("client_contracts")
    .select("id, unit_id, status")
    .in("unit_id", ids)
    .eq("status", "active");
  if (cErr) throw cErr;

  const unitByContract = new Map<string, string>();
  for (const c of contracts ?? []) {
    if (c.unit_id) unitByContract.set(c.id as string, c.unit_id as string);
  }
  if (!unitByContract.size) return empty;

  const { data: resources, error: rErr } = await supabase
    .from("contract_resources")
    .select("contract_id, designation_id, shift_hours, quantity")
    .in("contract_id", Array.from(unitByContract.keys()));
  if (rErr) throw rErr;

  const byUnitDesignation = new Map<string, number>();
  const tally = new Map<string, Map<number, number>>();
  const offered = new Map<string, Set<number>>();

  for (const r of resources ?? []) {
    const unitId = unitByContract.get(r.contract_id as string);
    if (!unitId) continue;
    const hours = normalize(r.shift_hours);
    if (r.designation_id) {
      const k = `${unitId}|${r.designation_id}`;
      if (!byUnitDesignation.has(k)) byUnitDesignation.set(k, hours);
      const o = offered.get(k) ?? new Set<number>();
      o.add(hours);
      offered.set(k, o);
    }
    const t = tally.get(unitId) ?? new Map<number, number>();
    t.set(hours, (t.get(hours) ?? 0) + (Number(r.quantity) || 1));
    tally.set(unitId, t);
  }

  const byUnit = new Map<string, number>();
  for (const [unitId, t] of tally) {
    let best = DEFAULT_SHIFT_HOURS;
    let bestCount = -1;
    for (const [hours, count] of t) {
      if (count > bestCount) {
        best = hours;
        bestCount = count;
      }
    }
    byUnit.set(unitId, best);
  }

  const byCandidateUnit = new Map<string, number>(await fetchPostingShifts(ids));
  return { byUnitDesignation, byUnit, byCandidateUnit, offered };
}

/** Attendance code for worked hours against the contractual shift length. */
export function attendanceCodeForShift(workedHours: number, shiftHours: number): "A" | "HD" | "P" {
  const shift = shiftHours === 12 ? 12 : DEFAULT_SHIFT_HOURS;
  if (workedHours >= shift) return "P";
  if (workedHours >= shift / 2) return "HD";
  return "A";
}

/** Overtime expressed in OT days (1 OT day = one full contractual shift). */
export function overtimeDaysForShift(workedHours: number, shiftHours: number): number {
  const shift = shiftHours === 12 ? 12 : DEFAULT_SHIFT_HOURS;
  const otHours = Math.max(0, workedHours - shift);
  return Math.round((otHours / shift) * 2) / 2;
}
