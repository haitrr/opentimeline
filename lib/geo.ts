const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Returns true if any point in `allPoints` falls between `prevMs` and `currMs`
 * (exclusive) and is outside `radiusKm` from the given center. Used to decide
 * whether a time gap between two nearby points represents the person leaving.
 */
export function hasEvidenceOfLeavingInGap(
  allPoints: { lat: number; lon: number; recordedAt: Date | string }[],
  prevMs: number,
  currMs: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number
): boolean {
  // Binary search for first point after prevMs (allPoints must be sorted by recordedAt)
  let lo = 0;
  let hi = allPoints.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (new Date(allPoints[mid].recordedAt).getTime() <= prevMs) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < allPoints.length; i++) {
    const t = new Date(allPoints[i].recordedAt).getTime();
    if (t >= currMs) break;
    if (haversineKm(allPoints[i].lat, allPoints[i].lon, centerLat, centerLon) > radiusKm)
      return true;
  }
  return false;
}

export function totalDistanceKm(
  points: { lat: number; lon: number }[]
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }
  return total;
}

/**
 * Computes the median latitude and longitude of a set of points.
 * More robust than the mean when GPS drift or noise pulls the running
 * average away from the true dwell location.
 */
export function medianLatLon(
  points: { lat: number; lon: number }[]
): { lat: number; lon: number } {
  if (points.length === 0) throw new Error("No points");
  const lats = points.map((p) => p.lat).sort((a, b) => a - b);
  const lons = points.map((p) => p.lon).sort((a, b) => a - b);
  const mid = Math.floor(lats.length / 2);
  const lat =
    lats.length % 2 === 0 ? (lats[mid - 1] + lats[mid]) / 2 : lats[mid];
  const lon =
    lons.length % 2 === 0 ? (lons[mid - 1] + lons[mid]) / 2 : lons[mid];
  return { lat, lon };
}
