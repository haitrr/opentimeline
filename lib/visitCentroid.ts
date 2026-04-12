export async function fetchVisitCentroid(
  arrivalAt: string,
  departureAt: string,
  fallback: { lat: number; lon: number },
): Promise<{ lat: number; lon: number }> {
  const params = new URLSearchParams({ start: arrivalAt, end: departureAt });
  try {
    const res = await fetch(`/api/location-centroid?${params}`);
    if (res.ok) {
      return (await res.json()) as { lat: number; lon: number };
    }
  } catch { /* fall through to fallback */ }
  return fallback;
}
