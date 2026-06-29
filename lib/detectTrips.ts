import { haversineKm, medianLatLon } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

export type DailyCentroid = { date: string; lat: number; lon: number };
export type TripCandidate = { name: string; startDate: string; endDate: string };

const DEFAULT_CLUSTER_RADIUS_KM = 50;
const DEFAULT_MIN_TRIP_DAYS = 2;
const DEFAULT_TRIP_DISTANCE_FROM_HOME_KM = 100;

export function computeDailyCentroids(
  points: { lat: number; lon: number; recordedAt: Date }[]
): DailyCentroid[] {
  const byDay = new Map<string, { latSum: number; lonSum: number; count: number }>();

  for (const p of points) {
    const day = p.recordedAt.toISOString().slice(0, 10);
    const agg = byDay.get(day) ?? { latSum: 0, lonSum: 0, count: 0 };
    agg.latSum += p.lat;
    agg.lonSum += p.lon;
    agg.count += 1;
    byDay.set(day, agg);
  }

  return Array.from(byDay.entries())
    .map(([date, { latSum, lonSum, count }]) => ({
      date,
      lat: latSum / count,
      lon: lonSum / count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function clusterConsecutiveDays(
  centroids: DailyCentroid[],
  radiusKm = DEFAULT_CLUSTER_RADIUS_KM
): DailyCentroid[][] {
  if (centroids.length === 0) return [];

  const clusters: DailyCentroid[][] = [];
  let current: DailyCentroid[] = [centroids[0]];

  for (let i = 1; i < centroids.length; i++) {
    const prev = centroids[i - 1];
    const curr = centroids[i];
    const dayGap =
      (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 86400000;

    const clusterLat = current.reduce((s, d) => s + d.lat, 0) / current.length;
    const clusterLon = current.reduce((s, d) => s + d.lon, 0) / current.length;
    const distKm = haversineKm(curr.lat, curr.lon, clusterLat, clusterLon);

    if (dayGap <= 2 && distKm <= radiusKm) {
      current.push(curr);
    } else {
      clusters.push(current);
      current = [curr];
    }
  }
  clusters.push(current);
  return clusters;
}

export function filterTripClusters(
  clusters: DailyCentroid[][],
  homeLat: number,
  homeLon: number,
  minDays = DEFAULT_MIN_TRIP_DAYS,
  minDistKm = DEFAULT_TRIP_DISTANCE_FROM_HOME_KM
): DailyCentroid[][] {
  return clusters.filter((cluster) => {
    if (cluster.length < minDays) return false;
    const { lat, lon } = medianLatLon(cluster);
    return haversineKm(lat, lon, homeLat, homeLon) >= minDistKm;
  });
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "OpenTimeline/1.0 (self-hosted)" },
    });
    if (!res.ok) return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    const data = (await res.json()) as {
      address?: { city?: string; town?: string; state?: string; country?: string };
    };
    const addr = data.address ?? {};
    const city = addr.city ?? addr.town ?? null;
    const state = addr.state ?? null;
    const country = addr.country ?? null;
    return [city, state, country].filter(Boolean).join(", ");
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

export async function detectTripCandidates(): Promise<TripCandidate[]> {
  const points = await prisma.locationPoint.findMany({
    select: { lat: true, lon: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });

  if (points.length === 0) return [];

  const centroids = computeDailyCentroids(points);
  if (centroids.length < DEFAULT_MIN_TRIP_DAYS) return [];

  const { lat: homeLat, lon: homeLon } = medianLatLon(centroids);

  const clusters = clusterConsecutiveDays(centroids);
  const tripClusters = filterTripClusters(clusters, homeLat, homeLon);

  const candidates = await Promise.all(
    tripClusters.map(async (cluster) => {
      const { lat, lon } = medianLatLon(cluster);
      const location = await reverseGeocode(lat, lon);
      const startDate = cluster[0].date;
      const endDate = cluster[cluster.length - 1].date;
      const startDateObj = new Date(`${startDate}T00:00:00Z`);
      const monthYear = startDateObj.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      const locationLabel = location.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      return { name: `${locationLabel} · ${monthYear}`, startDate, endDate };
    })
  );

  return candidates;
}
