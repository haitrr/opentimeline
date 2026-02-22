import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

export type PlaceData = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
};

export async function detectVisitsForPlace(
  placeId: number,
  timeWindowMinutes = 15
): Promise<number> {
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) return 0;

  const allPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { id: true, lat: true, lon: true, recordedAt: true },
  });

  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const radiusKm = place.radius / 1000;

  // Filter to points within radius
  const nearbyPoints = allPoints.filter(
    (p) => haversineKm(p.lat, p.lon, place.lat, place.lon) <= radiusKm
  );

  if (nearbyPoints.length === 0) return 0;

  // Group consecutive nearby points where gap <= timeWindow
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

  let newVisitsCount = 0;

  for (const group of groups) {
    const arrivalAt = new Date(group[0].recordedAt);
    const departureAt = new Date(group[group.length - 1].recordedAt);

    // Check for overlapping visit already recorded
    const existing = await prisma.visit.findFirst({
      where: {
        placeId,
        arrivalAt: { lte: departureAt },
        departureAt: { gte: arrivalAt },
      },
    });

    if (!existing) {
      await prisma.visit.create({
        data: { placeId, arrivalAt, departureAt, status: "suggested" },
      });
      newVisitsCount++;
    }
  }

  return newVisitsCount;
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
