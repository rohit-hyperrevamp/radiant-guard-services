/** Collect a fresh device fix, never substitute the assigned site's coordinates. */
export function freshBrowserPosition(geolocation: Geolocation): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let best: GeolocationPosition | undefined;
    let watchId: number | undefined;
    let finished = false;
    const finish = (error?: GeolocationPositionError) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (watchId !== undefined) geolocation.clearWatch(watchId);
      if (best) resolve(best);
      else reject(new Error(error?.message || "Unable to get a fresh location. Enable precise location and try again."));
    };
    const timer = setTimeout(() => finish(), 15_000);
    watchId = geolocation.watchPosition(
      (position) => {
        if (finished || Date.now() - position.timestamp > 15_000) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy <= 0) return;
        if (!best || accuracy < best.coords.accuracy) best = position;
        // Give coarse Wi-Fi fixes time to settle; precise fixes need no delay.
        if (accuracy <= 100) finish();
      },
      (error) => finish(error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    if (finished) geolocation.clearWatch(watchId);
  });
}

export function attendancePositionStatus(distance: number, accuracy: number, radius: number): "within" | "uncertain" | "outside" {
  if (distance <= radius) return "within";
  // Uncertainty changes the explanation, NEVER expands the allowed radius.
  if (!Number.isFinite(accuracy) || accuracy <= 0 || distance - accuracy <= radius) return "uncertain";
  return "outside";
}