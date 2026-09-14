import { isNativePlatform, logNativeEvent } from "@/lib/native";

export type LocationPermissionState = "granted" | "denied" | "prompt" | "unavailable";

/**
 * Ask the OS for foreground location access. On Android this shows the runtime
 * permission dialog (the same moment we ask for notifications), so GPS is not
 * left off by default after install.
 */
export async function requestLocationPermission(): Promise<LocationPermissionState> {
  if (!isNativePlatform()) {
    if (typeof navigator === "undefined" || !navigator.geolocation) return "unavailable";
    return "prompt";
  }
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    let status = await Geolocation.checkPermissions();
    if (status.location !== "granted") {
      status = await Geolocation.requestPermissions({ permissions: ["location"] });
    }
    logNativeEvent("location", "permission state", status);
    if (status.location === "granted") return "granted";
    if (status.location === "denied") return "denied";
    return "prompt";
  } catch (err) {
    logNativeEvent("location", "permission request failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return "unavailable";
  }
}

export async function checkLocationPermission(): Promise<LocationPermissionState> {
  if (!isNativePlatform()) {
    if (typeof navigator === "undefined" || !navigator.geolocation) return "unavailable";
    return "prompt";
  }
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return "granted";
    if (status.location === "denied") return "denied";
    return "prompt";
  } catch {
    return "unavailable";
  }
}

export const LOCATION_REQUIRED_MESSAGE =
  "Location (GPS) must be turned on to mark attendance. Enable location for Radiant Guard and try again.";
