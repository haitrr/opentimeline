import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

const CLUSTER_RADIUS_M = 50;
const MIN_DWELL_MINUTES = 15;
const TIME_GAP_MINUTES = 15;

type Point = { id: number; lat: number; lon: number; recordedAt: Date };

type Cluster = {
  points: Point[];
  centerLat: number;
  centerLon: number;
  arrivalAt: Date;
  departureAt: Date;
};

function updateCenter(cluster: Cluster, point: Point): void {
  const n = cluster.points.length;
  cluster.centerLat = (cluster.centerLat * n + point.lat) / (n + 1);
  cluster.centerLon = (cluster.centerLon * n + point.lon) / (n + 1);
}

export async function detectUnknownVisits(): Promise<number> {
  const allPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true },
  });

  if (allPoints.length === 0) return 0;

  const places = await prisma.place.findMany({
    select: { lat: true, lon: true, radius: true },
  });

  const clusterRadiusKm = CLUSTER_RADIUS_M / 1000;
  const timeGapMs = TIME_GAP_MINUTES * 60 * 1000;
  const minDwellMs = MIN_DWELL_MINUTES * 60 * 1000;

  // Build dwell clusters: consecutive points within 50m of cluster center
  // with no more than 15 min gap between consecutive points
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;

  for (const point of allPoints) {
    if (!current) {
      current = {
        points: [point],
        centerLat: point.lat,
        centerLon: point.lon,
        arrivalAt: point.recordedAt,
        departureAt: point.recordedAt,
      };
      continue;
    }

    const gap =
      point.recordedAt.getTime() - current.departureAt.getTime();
    const distKm = haversineKm(
      point.lat,
      point.lon,
      current.centerLat,
      current.centerLon
    );

    if (gap <= timeGapMs && distKm <= clusterRadiusKm) {
      updateCenter(current, point);
      current.points.push(point);
      current.departureAt = point.recordedAt;
    } else {
      clusters.push(current);
      current = {
        points: [point],
        centerLat: point.lat,
        centerLon: point.lon,
        arrivalAt: point.recordedAt,
        departureAt: point.recordedAt,
      };
    }
  }
  if (current) clusters.push(current);

  // Keep only clusters that dwelled for at least 15 minutes
  const dwellClusters = clusters.filter(
    (c) => c.departureAt.getTime() - c.arrivalAt.getTime() >= minDwellMs
  );

  // Remove clusters whose center is within any known place's radius
  const unknownClusters = dwellClusters.filter((c) => {
    return !places.some(
      (p) =>
        haversineKm(c.centerLat, c.centerLon, p.lat, p.lon) <=
        p.radius / 1000
    );
  });

  let created = 0;

  for (const cluster of unknownClusters) {
    // Deduplicate: skip if an overlapping suggestion already exists
    const existing = await prisma.unknownVisitSuggestion.findFirst({
      where: {
        arrivalAt: { lte: cluster.departureAt },
        departureAt: { gte: cluster.arrivalAt },
      },
    });

    if (!existing) {
      await prisma.unknownVisitSuggestion.create({
        data: {
          lat: cluster.centerLat,
          lon: cluster.centerLon,
          arrivalAt: cluster.arrivalAt,
          departureAt: cluster.departureAt,
          pointCount: cluster.points.length,
          status: "suggested",
        },
      });
      created++;
    }
  }

  return created;
}
