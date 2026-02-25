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
