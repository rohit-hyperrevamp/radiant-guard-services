import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Platform-wide switches stored as JSON rows in `inv_settings`. */
export const PLATFORM_SETTING_KEYS = {
  msg91Otp: "msg91_otp_enabled",
  employeeVerification: "employee_verification_enabled",
} as const;

export type PlatformSettingKey =
  (typeof PLATFORM_SETTING_KEYS)[keyof typeof PLATFORM_SETTING_KEYS];

export const platformFlagQueryKey = (key: PlatformSettingKey) =>
  ["platform-settings", key] as const;

/** Reads a platform switch. Missing rows fall back to `fallback` (default ON). */
export async function fetchPlatformFlag(
  key: PlatformSettingKey,
  fallback = true,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("inv_settings" as never)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  const value = (data as unknown as { value?: { enabled?: boolean } } | null)?.value;
  return Boolean(value?.enabled ?? fallback);
}

/** React hook for a platform switch — cached so forms don't refetch constantly. */
export function usePlatformFlag(key: PlatformSettingKey, fallback = true) {
  const q = useQuery({
    queryKey: platformFlagQueryKey(key),
    queryFn: () => fetchPlatformFlag(key, fallback),
    staleTime: 5 * 60_000,
  });
  return { enabled: q.data ?? fallback, isLoading: q.isLoading };
}

/** True when Aadhaar (DigiLocker), PAN and bank verification are switched on. */
export function useEmployeeVerificationEnabled() {
  return usePlatformFlag(PLATFORM_SETTING_KEYS.employeeVerification, true);
}
