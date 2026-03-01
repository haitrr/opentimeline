import { prisma } from "@/lib/prisma";
import { haversineKm, hasEvidenceOfLeavingInGap } from "@/lib/geo";

export type PlaceData = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  visitsInRange?: number;
  confirmedVisitsInRange?: number;
  suggestedVisitsInRange?: number;
};

type CandidateVisit = {
  arrivalAt: Date;
  departureAt: Date;
  distanceKm: number;
  pointCount: number;
};

type CandidateVisitWithPlace = CandidateVisit & {
  placeId: number;
};

type NearbyPoint = {
  id: number;
  lat: number;
  lon: number;
  recordedAt: Date;
  acc: number | null;
  distanceKm: number;
};

type ExistingSuggestedVisit = {
  id: number;
  arrivalAt: Date;
  departureAt: Date;
};

type ExistingVisitRange = {
  arrivalAt: Date;
  departureAt: Date;
};

type VisitRange = {
  arrivalAt: Date;
  departureAt: Date;
};

type PointRow = { id: number; lat: number; lon: number; recordedAt: Date; acc: number | null };

/**
 * Returns the last point in allPoints that is strictly before `beforeMs`
 * and is outside the given radius, within a lookback window of `maxLookbackMs`.
 * Used to interpolate a more accurate arrival time.
 */
function findLastOutsidePointBefore(
  allPoints: PointRow[],
  beforeMs: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  maxLookbackMs: number
): PointRow | null {
  // Binary search for last index with recordedAt <= beforeMs
  let lo = 0;
  let hi = allPoints.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (allPoints[mid].recordedAt.getTime() <= beforeMs) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  for (let i = idx; i >= 0; i--) {
    const t = allPoints[i].recordedAt.getTime();
    if (beforeMs - t > maxLookbackMs) break;
    if (haversineKm(allPoints[i].lat, allPoints[i].lon, centerLat, centerLon) > radiusKm) {
      return allPoints[i];
    }
  }
  return null;
}

/**
 * Returns the first point in allPoints strictly after `afterMs` that is
 * outside the given radius, within a forward window of `maxLookaheadMs`.
 * Used to interpolate a more accurate departure time.
 */
function findFirstOutsidePointAfter(
  allPoints: PointRow[],
  afterMs: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  maxLookaheadMs: number
): PointRow | null {
  // Binary search for first index with recordedAt > afterMs
  let lo = 0;
  let hi = allPoints.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (allPoints[mid].recordedAt.getTime() <= afterMs) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < allPoints.length; i++) {
    const t = allPoints[i].recordedAt.getTime();
    if (t - afterMs > maxLookaheadMs) break;
    if (haversineKm(allPoints[i].lat, allPoints[i].lon, centerLat, centerLon) > radiusKm) {
      return allPoints[i];
    }
  }
  return null;
}

function computeCandidateVisitsForPlace(
  place: { lat: number; lon: number; radius: number },
  allPoints: PointRow[],
  sessionGapMinutes: number,
  minDwellMinutes: number,
  postDepartureMinutes: number
): CandidateVisit[] {
  const sessionGapMs = sessionGapMinutes * 60 * 1000;
  const minDwellMs = minDwellMinutes * 60 * 1000;
  const postDepartureMs = postDepartureMinutes * 60 * 1000;
  const radiusKm = place.radius / 1000;

  // Bounding-box pre-filter: cheap arithmetic to skip haversine for points
  // that are clearly outside the radius. 1° lat ≈ 111.32 km; longitude degrees
  // shrink with cos(lat).
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos((place.lat * Math.PI) / 180));
  const latMin = place.lat - latDelta;
  const latMax = place.lat + latDelta;
  const lonMin = place.lon - lonDelta;
  const lonMax = place.lon + lonDelta;

  const nearbyPoints: NearbyPoint[] = allPoints
    .filter(
      (point) =>
        point.lat >= latMin &&
        point.lat <= latMax &&
        point.lon >= lonMin &&
        point.lon <= lonMax
    )
    .map((point) => ({
      ...point,
      distanceKm: haversineKm(point.lat, point.lon, place.lat, place.lon),
    }))
    .filter((point) => point.distanceKm <= radiusKm);

  if (nearbyPoints.length === 0) return [];

  const groups: typeof nearbyPoints[] = [];
  let currentGroup: typeof nearbyPoints = [nearbyPoints[0]];

  for (let i = 1; i < nearbyPoints.length; i++) {
    const prev = nearbyPoints[i - 1];
    const curr = nearbyPoints[i];
    const gap = curr.recordedAt.getTime() - prev.recordedAt.getTime();

    if (gap <= sessionGapMs) {
      currentGroup.push(curr);
    } else {
      // If the gap is larger than the time window, only split groups if there's
      // a point outside the radius between these two nearby points. Without such
      // evidence the person never left, so keep them in the same group.
      if (hasEvidenceOfLeavingInGap(allPoints, prev.recordedAt.getTime(), curr.recordedAt.getTime(), place.lat, place.lon, radiusKm)) {
        groups.push(currentGroup);
        currentGroup = [curr];
      } else {
        currentGroup.push(curr);
      }
    }
  }
  groups.push(currentGroup);

  const candidates: CandidateVisit[] = [];
  for (const group of groups) {
    const firstPoint = group[0];
    const lastPoint = group[group.length - 1];

    const rawArrivalMs = firstPoint.recordedAt.getTime();
    const rawDepartureMs = lastPoint.recordedAt.getTime();

    if (rawDepartureMs - rawArrivalMs < minDwellMs) continue;

    // Require a point outside the radius within postDepartureMs to confirm departure.
    const minTimeMs = rawDepartureMs + postDepartureMs;
    let lo = 0;
    let hi = allPoints.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (allPoints[mid].recordedAt.getTime() <= minTimeMs) lo = mid + 1;
      else hi = mid;
    }
    let hasLeftPlace = false;
    for (let j = lo; j < allPoints.length; j++) {
      const p = allPoints[j];
      // Outside bounding box → definitely outside radius; skip haversine.
      if (
        p.lat < latMin || p.lat > latMax || p.lon < lonMin || p.lon > lonMax ||
        haversineKm(p.lat, p.lon, place.lat, place.lon) > radiusKm
      ) {
        hasLeftPlace = true;
        break;
      }
    }
    if (!hasLeftPlace) continue;

    // (#1) Interpolate arrival/departure to the midpoint between the last outside
    // point and the first inside point (arrival) and vice versa (departure).
    // This corrects for GPS ping intervals so visit times aren't always quantised
    // to the exact moment a ping happened to land inside the radius.
    const outsideBefore = findLastOutsidePointBefore(
      allPoints,
      rawArrivalMs,
      place.lat,
      place.lon,
      radiusKm,
      sessionGapMs
    );
    const arrivalAt = outsideBefore
      ? new Date((outsideBefore.recordedAt.getTime() + rawArrivalMs) / 2)
      : firstPoint.recordedAt;

    const outsideAfter = findFirstOutsidePointAfter(
      allPoints,
      rawDepartureMs,
      place.lat,
      place.lon,
      radiusKm,
      postDepartureMs * 2
    );
    const departureAt = outsideAfter
      ? new Date((rawDepartureMs + outsideAfter.recordedAt.getTime()) / 2)
      : lastPoint.recordedAt;

    // (#2 + #4) Accuracy-weighted average distance as the conflict-resolution
    // metric. Weighting by 1/acc means more precise GPS fixes dominate.
    // Falls back to weight=1 when acc is null.
    let totalWeight = 0;
    let weightedDistanceSum = 0;
    for (const p of group) {
      const w = p.acc !== null && p.acc > 0 ? 1 / p.acc : 1;
      totalWeight += w;
      weightedDistanceSum += p.distanceKm * w;
    }
    const distanceKm = weightedDistanceSum / totalWeight;

    candidates.push({ arrivalAt, departureAt, distanceKm, pointCount: group.length });
  }

  return candidates;
}

async function detectCandidateVisitsForPlace(
  placeId: number,
  sessionGapMinutes = 15,
  minDwellMinutes = 15,
  postDepartureMinutes = 15,
  rangeStart?: Date,
  rangeEnd?: Date
): Promise<CandidateVisit[]> {
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) return [];

  const dayBufferMs = 5 * 24 * 60 * 60 * 1000;
  const allPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true, acc: true },
    where:
      rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart
                ? [{ recordedAt: { gte: new Date(rangeStart.getTime() - dayBufferMs) } }]
                : []),
              ...(rangeEnd
                ? [{ recordedAt: { lte: new Date(rangeEnd.getTime() + dayBufferMs) } }]
                : []),
            ],
          }
        : undefined,
  });

  return computeCandidateVisitsForPlace(place, allPoints, sessionGapMinutes, minDwellMinutes, postDepartureMinutes);
}

function overlaps(a: VisitRange, b: VisitRange): boolean {
  return a.arrivalAt < b.departureAt && a.departureAt > b.arrivalAt;
}

function selectClosestCandidatesPerTimeRange(
  candidates: CandidateVisitWithPlace[]
): CandidateVisitWithPlace[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((left, right) => {
    const startDiff = left.arrivalAt.getTime() - right.arrivalAt.getTime();
    if (startDiff !== 0) return startDiff;

    const endDiff = left.departureAt.getTime() - right.departureAt.getTime();
    if (endDiff !== 0) return endDiff;

    if (left.distanceKm !== right.distanceKm) {
      return left.distanceKm - right.distanceKm;
    }

    return left.placeId - right.placeId;
  });

  const selected: CandidateVisitWithPlace[] = [];
  let currentGroup: CandidateVisitWithPlace[] = [sorted[0]];
  let currentGroupEnd = sorted[0].departureAt;

  for (let i = 1; i < sorted.length; i++) {
    const candidate = sorted[i];

    if (candidate.arrivalAt <= currentGroupEnd) {
      currentGroup.push(candidate);
      if (candidate.departureAt > currentGroupEnd) {
        currentGroupEnd = candidate.departureAt;
      }
      continue;
    }

    const winner = currentGroup.reduce((best, current) => {
      if (current.distanceKm !== best.distanceKm) {
        return current.distanceKm < best.distanceKm ? current : best;
      }

      return current.placeId < best.placeId ? current : best;
    });
    selected.push(winner);

    currentGroup = [candidate];
    currentGroupEnd = candidate.departureAt;
  }

  const winner = currentGroup.reduce((best, current) => {
    if (current.distanceKm !== best.distanceKm) {
      return current.distanceKm < best.distanceKm ? current : best;
    }

    return current.placeId < best.placeId ? current : best;
  });
  selected.push(winner);

  return selected;
}

export async function detectVisitsForPlace(
  placeId: number
): Promise<number> {
  const candidates = await detectCandidateVisitsForPlace(placeId);

  // (#3) Bulk-fetch all existing visits for this place upfront to avoid
  // one DB round-trip per candidate.
  const allExisting = await prisma.visit.findMany({
    where: { placeId },
    select: { arrivalAt: true, departureAt: true },
  });

  // Also fetch confirmed visits from other places to avoid creating suggestions
  // that overlap with already-confirmed visits at other places.
  const confirmedElsewhere = await prisma.visit.findMany({
    where: { status: "confirmed", NOT: { placeId } },
    select: { arrivalAt: true, departureAt: true },
  });

  let newVisitsCount = 0;
  for (const candidate of candidates) {
    const hasOverlap = allExisting.some((v: ExistingVisitRange) =>
      overlaps(candidate, { arrivalAt: v.arrivalAt, departureAt: v.departureAt })
    );
    const blockedByConfirmedElsewhere = confirmedElsewhere.some(
      (v: ExistingVisitRange) =>
        overlaps(candidate, { arrivalAt: v.arrivalAt, departureAt: v.departureAt })
    );

    if (!hasOverlap && !blockedByConfirmedElsewhere) {
      await prisma.visit.create({
        data: {
          placeId,
          arrivalAt: candidate.arrivalAt,
          departureAt: candidate.departureAt,
          status: "suggested",
          pointCount: candidate.pointCount,
        },
      });
      allExisting.push({ arrivalAt: candidate.arrivalAt, departureAt: candidate.departureAt });
      newVisitsCount++;
    }
  }

  return newVisitsCount;
}

export async function reconcileVisitSuggestionsForPlace(
  placeId: number
): Promise<{ removed: number; added: number }> {
  const candidates = await detectCandidateVisitsForPlace(placeId);

  const existingSuggested = await prisma.visit.findMany({
    where: { placeId, status: "suggested" },
    select: { id: true, arrivalAt: true, departureAt: true },
  });

  const toRemove = existingSuggested
    .filter(
      (visit: ExistingSuggestedVisit) =>
        !candidates.some((candidate) =>
          overlaps(candidate, {
            arrivalAt: visit.arrivalAt,
            departureAt: visit.departureAt,
          })
        )
    )
    .map((visit: ExistingSuggestedVisit) => visit.id);

  if (toRemove.length > 0) {
    await prisma.visit.deleteMany({ where: { id: { in: toRemove } } });
  }

  const allExisting = await prisma.visit.findMany({
    where: { placeId },
    select: { arrivalAt: true, departureAt: true },
  });

  // Also fetch confirmed visits from other places to avoid creating suggestions
  // that overlap with already-confirmed visits at other places.
  const confirmedElsewhere = await prisma.visit.findMany({
    where: { status: "confirmed", NOT: { placeId } },
    select: { arrivalAt: true, departureAt: true },
  });

  let added = 0;
  for (const candidate of candidates) {
    const hasOverlap = allExisting.some((visit: ExistingVisitRange) =>
      overlaps(candidate, {
        arrivalAt: visit.arrivalAt,
        departureAt: visit.departureAt,
      })
    );
    const blockedByConfirmedElsewhere = confirmedElsewhere.some(
      (v: ExistingVisitRange) =>
        overlaps(candidate, { arrivalAt: v.arrivalAt, departureAt: v.departureAt })
    );

    if (!hasOverlap && !blockedByConfirmedElsewhere) {
      await prisma.visit.create({
        data: {
          placeId,
          arrivalAt: candidate.arrivalAt,
          departureAt: candidate.departureAt,
          status: "suggested",
          pointCount: candidate.pointCount,
        },
      });
      allExisting.push({
        arrivalAt: candidate.arrivalAt,
        departureAt: candidate.departureAt,
      });
      added++;
    }
  }

  return { removed: toRemove.length, added };
}

export async function detectVisitsForAllPlaces(
  sessionGapMinutes = 15,
  minDwellMinutes = 15,
  postDepartureMinutes = 15,
  rangeStart?: Date,
  rangeEnd?: Date
): Promise<number> {
  const places = await prisma.place.findMany({ where: { isActive: true } });

  // Fetch all points once and share across all places to avoid N separate DB queries.
  const dayBufferMs = 5 * 24 * 60 * 60 * 1000;
  const sharedPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true, acc: true },
    where:
      rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart
                ? [{ recordedAt: { gte: new Date(rangeStart.getTime() - dayBufferMs) } }]
                : []),
              ...(rangeEnd
                ? [{ recordedAt: { lte: new Date(rangeEnd.getTime() + dayBufferMs) } }]
                : []),
            ],
          }
        : undefined,
  });

  const allCandidates: CandidateVisitWithPlace[] = [];
  for (const place of places) {
    const candidates = computeCandidateVisitsForPlace(place, sharedPoints, sessionGapMinutes, minDwellMinutes, postDepartureMinutes);

    for (const candidate of candidates) {
      allCandidates.push({
        placeId: place.id,
        arrivalAt: candidate.arrivalAt,
        departureAt: candidate.departureAt,
        distanceKm: candidate.distanceKm,
        pointCount: candidate.pointCount,
      });
    }
  }

  const rangeFiltered =
    rangeStart || rangeEnd
      ? allCandidates.filter((c) => {
          const arrivalInRange =
            (!rangeStart || c.arrivalAt >= rangeStart) &&
            (!rangeEnd || c.arrivalAt <= rangeEnd);
          const departureInRange =
            (!rangeStart || c.departureAt >= rangeStart) &&
            (!rangeEnd || c.departureAt <= rangeEnd);
          return arrivalInRange || departureInRange;
        })
      : allCandidates;

  const winningCandidates = selectClosestCandidatesPerTimeRange(rangeFiltered);

  // Delete all suggested visits in range — they'll be replaced by fresh detection
  // results. Confirmed visits are never touched.
  await prisma.visit.deleteMany({
    where: {
      status: "suggested",
      ...(rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart ? [{ departureAt: { gte: rangeStart } }] : []),
              ...(rangeEnd ? [{ arrivalAt: { lte: rangeEnd } }] : []),
            ],
          }
        : {}),
    },
  });

  // Only confirmed visits block new suggestions from being created.
  const confirmedVisits = await prisma.visit.findMany({
    select: { arrivalAt: true, departureAt: true },
    where: {
      status: "confirmed",
      ...(rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart ? [{ departureAt: { gte: rangeStart } }] : []),
              ...(rangeEnd ? [{ arrivalAt: { lte: rangeEnd } }] : []),
            ],
          }
        : {}),
    },
  });

  const toAdd = winningCandidates.filter(
    (candidate) =>
      !confirmedVisits.some((visit: ExistingVisitRange) =>
        overlaps(candidate, {
          arrivalAt: visit.arrivalAt,
          departureAt: visit.departureAt,
        })
      )
  );

  await Promise.all(
    toAdd.map((candidate) =>
      prisma.visit.create({
        data: {
          placeId: candidate.placeId,
          arrivalAt: candidate.arrivalAt,
          departureAt: candidate.departureAt,
          status: "suggested",
          pointCount: candidate.pointCount,
        },
      })
    )
  );

  return toAdd.length;
}
