export async function fetchVisitCentroid(
  arrivalAt: string,
  departureAt: string,
  fallback: { lat: number; lon: number }
): Promise<{ lat: number; lon: number }> {
  const params = new URLSearchParams({ start: arrivalAt, end: departureAt });
  try {
    const res = await fetch(`/api/locations?${params}`);
    if (res.ok) {
      const points: Array<{ lat: number; lon: number }> = await res.json();
      if (points.length > 0) {
        return {
          lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
          lon: points.reduce((s, p) => s + p.lon, 0) / points.length,
        };
      }
    }
  } catch { /* fall through to fallback */ }
  return fallback;
}
