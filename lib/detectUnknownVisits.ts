import { prisma } from "@/lib/prisma";
import { haversineKm, hasEvidenceOfLeavingInGap, medianLatLon } from "@/lib/geo";


type Point = { id: number; lat: number; lon: number; recordedAt: Date; acc: number | null };

type Cluster = {
  points: Point[];
  // Running center used for membership decisions during the forward pass.
  // Accuracy-weighted so precise fixes steer the centroid more than noisy ones.
  centerLat: number;
  centerLon: number;
  totalWeight: number;
  arrivalAt: Date;
  departureAt: Date;
};

// (#6 + #2) Accuracy-weighted incremental centroid update.
// Weight = 1/acc (accurate points dominate); falls back to 1 when acc is null.
function updateCenter(cluster: Cluster, point: Point): void {
  const w = point.acc !== null && point.acc > 0 ? 1 / point.acc : 1;
  const newWeight = cluster.totalWeight + w;
  cluster.centerLat = (cluster.centerLat * cluster.totalWeight + point.lat * w) / newWeight;
  cluster.centerLon = (cluster.centerLon * cluster.totalWeight + point.lon * w) / newWeight;
  cluster.totalWeight = newWeight;
}

function initCluster(point: Point): Cluster {
  const w = point.acc !== null && point.acc > 0 ? 1 / point.acc : 1;
  return {
    points: [point],
    centerLat: point.lat,
    centerLon: point.lon,
    totalWeight: w,
    arrivalAt: point.recordedAt,
    departureAt: point.recordedAt,
  };
}

// (#7) Merge adjacent clusters that are spatially close (within clusterRadiusKm)
// and have no confirmed evidence of leaving in the gap between them.
// Handles cases where a brief excursion outside the GPS radius (e.g., a trip to
// the car) prematurely split what is really one continuous dwell.
function mergeAdjacentClusters(
  clusters: Cluster[],
  clusterRadiusKm: number,
  timeGapMs: number,
  allPoints: Point[]
): Cluster[] {
  let changed = true;
  let current = clusters;

  while (changed) {
    changed = false;
    const merged: Cluster[] = [];
    let i = 0;

    while (i < current.length) {
      const a = current[i];

      if (i + 1 < current.length) {
        const b = current[i + 1];
        const gap = b.arrivalAt.getTime() - a.departureAt.getTime();
        const dist = haversineKm(a.centerLat, a.centerLon, b.centerLat, b.centerLon);

        // Midpoint center for the leaving-evidence check
        const midLat = (a.centerLat + b.centerLat) / 2;
        const midLon = (a.centerLon + b.centerLon) / 2;

        if (
          dist <= clusterRadiusKm &&
          gap <= timeGapMs &&
          !hasEvidenceOfLeavingInGap(
            allPoints,
            a.departureAt.getTime(),
            b.arrivalAt.getTime(),
            midLat,
            midLon,
            clusterRadiusKm
          )
        ) {
          // Merge b into a
          const combinedPoints = [...a.points, ...b.points];
          const nA = a.points.length;
          const nB = b.points.length;
          merged.push({
            points: combinedPoints,
            centerLat: (a.centerLat * nA + b.centerLat * nB) / (nA + nB),
            centerLon: (a.centerLon * nA + b.centerLon * nB) / (nA + nB),
            totalWeight: a.totalWeight + b.totalWeight,
            arrivalAt: a.arrivalAt,
            departureAt: b.departureAt,
          });
          i += 2;
          changed = true;
          continue;
        }
      }

      merged.push(a);
      i++;
    }

    current = merged;
  }

  return current;
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
    select: { id: true, lat: true, lon: true, recordedAt: true, acc: true },
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

  // Build dwell clusters: consecutive points within clusterRadiusKm of the
  // (accuracy-weighted) cluster center with no more than sessionGapMs between
  // consecutive points unless there is no evidence of leaving.
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;

  for (const point of allPoints) {
    if (!current) {
      current = initCluster(point);
      continue;
    }

    const gap = point.recordedAt.getTime() - current.departureAt.getTime();
    const distKm = haversineKm(point.lat, point.lon, current.centerLat, current.centerLon);

    if (distKm > clusterRadiusKm) {
      // Point is outside cluster radius — always start a new cluster
      clusters.push(current);
      current = initCluster(point);
    } else if (gap <= timeGapMs) {
      // Within radius and within time window — extend cluster
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
        current = initCluster(point);
      } else {
        updateCenter(current, point);
        current.points.push(point);
        current.departureAt = point.recordedAt;
      }
    }
  }
  if (current) clusters.push(current);

  // (#7) Post-processing merge: rejoin spatially close adjacent clusters
  // that were split by a brief departure with no GPS evidence.
  const mergedClusters = mergeAdjacentClusters(clusters, clusterRadiusKm, timeGapMs, allPoints);

  // Keep only clusters that dwelled for at least minDwellMinutes
  const dwellClusters = mergedClusters.filter(
    (c) => c.departureAt.getTime() - c.arrivalAt.getTime() >= minDwellMs
  );

  // (#8) Remove clusters whose points are predominantly inside a known place.
  // Checking ≥50% of points (rather than just the drifted center) handles cases
  // where the running centroid has shifted outside the place radius even though
  // the person was clearly at that place.
  // Also exclude clusters that span outside the detection date range.
  const KNOWN_PLACE_POINT_FRACTION = 0.5;

  const unknownClusters = dwellClusters.filter((c) => {
    if (rangeStart && c.arrivalAt < rangeStart) return false;
    if (rangeEnd && c.departureAt > rangeEnd) return false;
    return !places.some((p: (typeof places)[number]) => {
      const placeRadiusKm = p.radius / 1000;
      const pointsInside = c.points.filter(
        (pt) => haversineKm(pt.lat, pt.lon, p.lat, p.lon) <= placeRadiusKm
      ).length;
      return pointsInside / c.points.length >= KNOWN_PLACE_POINT_FRACTION;
    });
  });

  let created = 0;

  for (const cluster of unknownClusters) {
    // (#6 + #10) Use the median position as the stored cluster center.
    // The median is robust to GPS drift (running mean shifts toward peripheral
    // fixes) and indoor noise (scattered points around the true location).
    const { lat: centerLat, lon: centerLon } = medianLatLon(cluster.points);

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
          lat: centerLat,
          lon: centerLon,
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
