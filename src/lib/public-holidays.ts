import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getReference } from "@/lib/reference-data";

export const MONTH_NAMES: string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const QK_PUBLIC_HOLIDAYS = ["admin", "public-holidays"] as const;

export type PublicHoliday = {
  id: string;
  name: string;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  enabled: boolean;
  sortOrder: number;
};

/** Enabled public holidays only — these repeat every year on the same date. */
export function fetchEnabledPublicHolidays(): Promise<PublicHoliday[]> {
  return fetchEnabledPublicHolidaysWith(supabase);
}

/**
 * Enabled holidays from raw public_holidays rows, in the order the direct read
 * returns them (holiday_month, then holiday_day; ties keep their row order).
 */
export function enabledPublicHolidaysFromRows(rows: Record<string, unknown>[]): PublicHoliday[] {
  return rows
    .filter((r) => r.enabled === true)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      month: Number(r.holiday_month ?? 1),
      day: Number(r.holiday_day ?? 1),
      enabled: Boolean(r.enabled ?? true),
      sortOrder: Number(r.sort_order ?? 0),
    }))
    .sort((a, b) => a.month - b.month || a.day - b.day);
}

export async function fetchEnabledPublicHolidaysWith(db: typeof supabase): Promise<PublicHoliday[]> {
  // App client: the shared session-cached master (invalidated by the holiday
  // manager on save). Other clients (server / tests) read directly.
  if (db === supabase) return enabledPublicHolidaysFromRows(await getReference<Record<string, unknown>>("publicHolidays"));
  const { data, error } = await db
    .from("public_holidays" as never)
    .select("id,name,holiday_month,holiday_day,enabled,sort_order")
    .eq("enabled", true)
    .order("holiday_month")
    .order("holiday_day");
  if (error) throw error;
  return enabledPublicHolidaysFromRows((data ?? []) as unknown as Record<string, unknown>[]);
}

export function usePublicHolidays() {
  const { data = [] } = useQuery({
    queryKey: [...QK_PUBLIC_HOLIDAYS, "enabled"],
    queryFn: fetchEnabledPublicHolidays,
  });
  return data;
}

/** Map of "YYYY-MM-DD" → holiday name for every date in the given ISO date list. */
export function holidayMapForDates(dates: string[], holidays: PublicHoliday[]): Map<string, string> {
  const byMd = new Map(holidays.map((h) => [`${h.month}-${h.day}`, h.name]));
  const out = new Map<string, string>();
  for (const iso of dates) {
    const [, mm, dd] = iso.split("-").map(Number);
    const name = byMd.get(`${mm}-${dd}`);
    if (name) out.set(iso, name);
  }
  return out;
}
