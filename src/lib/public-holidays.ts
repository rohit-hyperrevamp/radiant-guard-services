import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
export async function fetchEnabledPublicHolidays(): Promise<PublicHoliday[]> {
  const { data, error } = await supabase
    .from("public_holidays" as never)
    .select("id,name,holiday_month,holiday_day,enabled,sort_order")
    .eq("enabled", true)
    .order("holiday_month")
    .order("holiday_day");
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    month: Number(r.holiday_month ?? 1),
    day: Number(r.holiday_day ?? 1),
    enabled: Boolean(r.enabled ?? true),
    sortOrder: Number(r.sort_order ?? 0),
  }));
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
