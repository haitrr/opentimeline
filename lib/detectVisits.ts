import { prisma } from "@/lib/prisma";
import { haversineKm, hasEvidenceOfLeavingInGap } from "@/lib/geo";

export type PlaceData = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  visitsInRange?: number;
  confirmedVisitsInRange?: number;
  suggestedVisitsInRange?: number;
};

type CandidateVisit = {
  arrivalAt: Date;
  departureAt: Date;
  distanceKm: number;
};

type CandidateVisitWithPlace = CandidateVisit & {
  placeId: number;
};

type NearbyPoint = {
  id: number;
  lat: number;
  lon: number;
  recordedAt: Date;
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

type PointRow = { id: number; lat: number; lon: number; recordedAt: Date };

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

  const nearbyPoints: NearbyPoint[] = allPoints
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
    const arrivalAt = group[0].recordedAt;
    const departureAt = group[group.length - 1].recordedAt;

    if (departureAt.getTime() - arrivalAt.getTime() < minDwellMs) continue;

    // Only count a visit if the person has clearly left: there must be a point
    // outside the place radius recorded at least postDepartureMinutes after the last
    // point in this group. This avoids counting ongoing visits with wrong duration.
    // Binary search for first point after departureAt + postDepartureMs.
    const minTimeMs = departureAt.getTime() + postDepartureMs;
    let lo = 0;
    let hi = allPoints.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (allPoints[mid].recordedAt.getTime() <= minTimeMs) lo = mid + 1;
      else hi = mid;
    }
    let hasLeftPlace = false;
    for (let j = lo; j < allPoints.length; j++) {
      if (haversineKm(allPoints[j].lat, allPoints[j].lon, place.lat, place.lon) > radiusKm) {
        hasLeftPlace = true;
        break;
      }
    }
    if (!hasLeftPlace) continue;

    const distanceKm = group.reduce(
      (minDistance: number, point: NearbyPoint) =>
        Math.min(minDistance, point.distanceKm),
      Number.POSITIVE_INFINITY
    );
    candidates.push({ arrivalAt, departureAt, distanceKm });
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
    select: { id: true, lat: true, lon: true, recordedAt: true },
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
  return a.arrivalAt <= b.departureAt && a.departureAt >= b.arrivalAt;
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

  let newVisitsCount = 0;
  for (const candidate of candidates) {

    // Check for overlapping visit already recorded
    const existing = await prisma.visit.findFirst({
      where: {
        arrivalAt: { lte: candidate.departureAt },
        departureAt: { gte: candidate.arrivalAt },
      },
    });

    if (!existing) {
      await prisma.visit.create({
        data: {
          placeId,
          arrivalAt: candidate.arrivalAt,
          departureAt: candidate.departureAt,
          status: "suggested",
        },
      });
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

  let added = 0;
  for (const candidate of candidates) {
    const hasOverlap = allExisting.some((visit: ExistingVisitRange) =>
      overlaps(candidate, {
        arrivalAt: visit.arrivalAt,
        departureAt: visit.departureAt,
      })
    );

    if (!hasOverlap) {
      await prisma.visit.create({
        data: {
          placeId,
          arrivalAt: candidate.arrivalAt,
          departureAt: candidate.departureAt,
          status: "suggested",
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
  const places = await prisma.place.findMany();

  // Fetch all points once and share across all places to avoid N separate DB queries.
  const dayBufferMs = 5 * 24 * 60 * 60 * 1000;
  const sharedPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true },
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

  const existingSuggested: Array<{
    id: number;
    placeId: number;
    arrivalAt: Date;
    departureAt: Date;
  }> = await prisma.visit.findMany({
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
    select: { id: true, placeId: true, arrivalAt: true, departureAt: true },
  });

  const toRemove = existingSuggested
    .filter(
      (suggestedVisit: {
        id: number;
        placeId: number;
        arrivalAt: Date;
        departureAt: Date;
      }) =>
        !winningCandidates.some(
          (candidate) =>
            candidate.placeId === suggestedVisit.placeId &&
            overlaps(candidate, {
              arrivalAt: suggestedVisit.arrivalAt,
              departureAt: suggestedVisit.departureAt,
            })
        )
    )
    .map((visit: { id: number }) => visit.id);

  if (toRemove.length > 0) {
    await prisma.visit.deleteMany({ where: { id: { in: toRemove } } });
  }

  const allExistingVisits = await prisma.visit.findMany({
    select: { arrivalAt: true, departureAt: true },
    where:
      rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart ? [{ departureAt: { gte: rangeStart } }] : []),
              ...(rangeEnd ? [{ arrivalAt: { lte: rangeEnd } }] : []),
            ],
          }
        : undefined,
  });

  let added = 0;
  for (const candidate of winningCandidates) {
    const hasOverlap = allExistingVisits.some((visit: ExistingVisitRange) =>
      overlaps(candidate, {
        arrivalAt: visit.arrivalAt,
        departureAt: visit.departureAt,
      })
    );

    if (!hasOverlap) {
      await prisma.visit.create({
        data: {
          placeId: candidate.placeId,
          arrivalAt: candidate.arrivalAt,
          departureAt: candidate.departureAt,
          status: "suggested",
        },
      });

      allExistingVisits.push({
        arrivalAt: candidate.arrivalAt,
        departureAt: candidate.departureAt,
      });
      added++;
    }
  }

  return added;
}
