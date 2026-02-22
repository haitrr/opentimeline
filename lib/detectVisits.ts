import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

export type PlaceData = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
};

type CandidateVisit = {
  arrivalAt: Date;
  departureAt: Date;
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

async function detectCandidateVisitsForPlace(
  placeId: number,
  timeWindowMinutes = 15
): Promise<CandidateVisit[]> {
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) return [];

  const allPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true },
  });

  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const radiusKm = place.radius / 1000;

  const nearbyPoints = allPoints.filter(
    (p: (typeof allPoints)[number]) =>
      haversineKm(p.lat, p.lon, place.lat, place.lon) <= radiusKm
  );

  if (nearbyPoints.length === 0) return [];

  const groups: typeof nearbyPoints[] = [];
  let currentGroup: typeof nearbyPoints = [nearbyPoints[0]];

  for (let i = 1; i < nearbyPoints.length; i++) {
    const prev = nearbyPoints[i - 1];
    const curr = nearbyPoints[i];
    const gap =
      new Date(curr.recordedAt).getTime() -
      new Date(prev.recordedAt).getTime();

    if (gap <= timeWindowMs) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  const candidates: CandidateVisit[] = [];
  for (const group of groups) {
    const arrivalAt = new Date(group[0].recordedAt);
    const departureAt = new Date(group[group.length - 1].recordedAt);

    if (departureAt.getTime() - arrivalAt.getTime() < timeWindowMs) continue;
    candidates.push({ arrivalAt, departureAt });
  }

  return candidates;
}

function overlaps(a: CandidateVisit, b: CandidateVisit): boolean {
  return a.arrivalAt <= b.departureAt && a.departureAt >= b.arrivalAt;
}

export async function detectVisitsForPlace(
  placeId: number,
  timeWindowMinutes = 15
): Promise<number> {
  const candidates = await detectCandidateVisitsForPlace(
    placeId,
    timeWindowMinutes
  );

  let newVisitsCount = 0;
  for (const candidate of candidates) {

    // Check for overlapping visit already recorded
    const existing = await prisma.visit.findFirst({
      where: {
        placeId,
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
  placeId: number,
  timeWindowMinutes = 15
): Promise<{ removed: number; added: number }> {
  const candidates = await detectCandidateVisitsForPlace(
    placeId,
    timeWindowMinutes
  );

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
  timeWindowMinutes = 15
): Promise<number> {
  const places = await prisma.place.findMany();
  let total = 0;
  for (const place of places) {
    total += await detectVisitsForPlace(place.id, timeWindowMinutes);
  }
  return total;
}
