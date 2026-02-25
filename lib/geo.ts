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
  return allPoints.some((p) => {
    const t = new Date(p.recordedAt).getTime();
    return (
      t > prevMs &&
      t < currMs &&
      haversineKm(p.lat, p.lon, centerLat, centerLon) > radiusKm
    );
  });
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
