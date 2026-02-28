import { prisma } from "@/lib/prisma";
import { haversineKm, hasEvidenceOfLeavingInGap } from "@/lib/geo";


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

export async function detectUnknownVisits(
  rangeStart?: Date,
  rangeEnd?: Date,
  sessionGapMinutes = 15,
  minDwellMinutes = 15,
  clusterRadiusM = 50
): Promise<number> {
  const sessionGapMs = sessionGapMinutes * 60 * 1000;

  const allPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true },
    where:
      rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart
                ? [
                    {
                      recordedAt: {
                        gte: new Date(rangeStart.getTime() - sessionGapMs),
                      },
                    },
                  ]
                : []),
              ...(rangeEnd
                ? [
                    {
                      recordedAt: {
                        lte: new Date(rangeEnd.getTime() + sessionGapMs),
                      },
                    },
                  ]
                : []),
            ],
          }
        : undefined,
  });

  if (allPoints.length === 0) return 0;

  const places = await prisma.place.findMany({
    select: { lat: true, lon: true, radius: true },
  });

  const clusterRadiusKm = clusterRadiusM / 1000;
  const timeGapMs = sessionGapMs;
  const minDwellMs = minDwellMinutes * 60 * 1000;

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

    if (distKm > clusterRadiusKm) {
      // Point is outside cluster radius — always start a new cluster
      clusters.push(current);
      current = {
        points: [point],
        centerLat: point.lat,
        centerLon: point.lon,
        arrivalAt: point.recordedAt,
        departureAt: point.recordedAt,
      };
    } else if (gap <= timeGapMs) {
      // Within radius and within time window — extend cluster normally
      updateCenter(current, point);
      current.points.push(point);
      current.departureAt = point.recordedAt;
    } else {
      // Within radius but gap exceeds time window. Only split if there's a
      // point outside the cluster radius between the two timestamps —
      // otherwise the person never left and the cluster should continue.
      const prevTime = current.departureAt.getTime();
      const currTime = point.recordedAt.getTime();
      if (hasEvidenceOfLeavingInGap(allPoints, prevTime, currTime, current.centerLat, current.centerLon, clusterRadiusKm)) {
        clusters.push(current);
        current = {
          points: [point],
          centerLat: point.lat,
          centerLon: point.lon,
          arrivalAt: point.recordedAt,
          departureAt: point.recordedAt,
        };
      } else {
        updateCenter(current, point);
        current.points.push(point);
        current.departureAt = point.recordedAt;
      }
    }
  }
  if (current) clusters.push(current);

  // Keep only clusters that dwelled for at least 15 minutes
  const dwellClusters = clusters.filter(
    (c) => c.departureAt.getTime() - c.arrivalAt.getTime() >= minDwellMs
  );

  // Remove clusters whose center is within any known place's radius
  // Also exclude clusters that are ongoing at either range boundary
  const unknownClusters = dwellClusters.filter((c) => {
    if (rangeStart && c.arrivalAt < rangeStart) return false;
    if (rangeEnd && c.departureAt > rangeEnd) return false;
    return !places.some(
      (p: (typeof places)[number]) =>
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
