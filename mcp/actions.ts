import { prisma } from "@/lib/prisma";
import { detectVisitsForAllPlaces } from "@/lib/detectVisits";
import { detectUnknownVisits } from "@/lib/detectUnknownVisits";
import { haversineKm } from "@/lib/geo";
import { getImmichPhotos, isImmichConfigured } from "@/lib/immich";

export type DateRangeInput = {
  start?: string;
  end?: string;
};

export type LimitInput = {
  limit?: number;
};

export type VisitStatus = "confirmed" | "suggested" | "all";
export type UnknownVisitStatus = "suggested" | "confirmed" | "rejected";

async function getSettings() {
  return prisma.appSettings.findUnique({ where: { id: 1 } });
}

function parseDateRange({ start, end }: DateRangeInput) {
  return {
    startDate: start ? new Date(start) : undefined,
    endDate: end ? new Date(end) : undefined,
  };
}

function serializeDate(date: Date) {
  return date.toISOString();
}

function durationMinutes(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export async function triggerVisitDetection(input: DateRangeInput = {}) {
  const settings = await getSettings();
  const { startDate, endDate } = parseDateRange(input);
  const newVisits = await detectVisitsForAllPlaces(
    settings?.sessionGapMinutes ?? 15,
    settings?.minDwellMinutes ?? 15,
    settings?.postDepartureMinutes ?? 15,
    startDate,
    endDate,
  );
  return { newVisits };
}

export async function triggerUnknownVisitDetection(input: DateRangeInput = {}) {
  const settings = await getSettings();
  const created = await detectUnknownVisits(
    input.start ? new Date(input.start) : undefined,
    input.end ? new Date(input.end) : undefined,
    settings?.unknownSessionGapMinutes ?? 15,
    settings?.unknownMinDwellMinutes ?? 15,
    settings?.unknownClusterRadiusM ?? 50,
  );
  return { created };
}

export async function getPendingUnknownVisits(input: DateRangeInput & LimitInput & { status?: UnknownVisitStatus } = {}) {
  const { status = "suggested", start, end, limit = 50 } = input;
  const suggestions = await prisma.unknownVisitSuggestion.findMany({
    where: {
      status,
      ...(start || end ? {
        AND: [
          ...(end ? [{ arrivalAt: { lt: new Date(end) } }] : []),
          ...(start ? [{ departureAt: { gt: new Date(start) } }] : []),
        ],
      } : {}),
    },
    orderBy: { arrivalAt: "asc" },
    take: limit,
  });

  return suggestions.map((suggestion) => ({
    ...suggestion,
    arrivalAt: serializeDate(suggestion.arrivalAt),
    departureAt: serializeDate(suggestion.departureAt),
    createdAt: serializeDate(suggestion.createdAt),
    durationMinutes: durationMinutes(suggestion.arrivalAt, suggestion.departureAt),
  }));
}

export async function reviewUnknownVisit(id: number) {
  const visit = await prisma.unknownVisitSuggestion.findUnique({ where: { id } });
  if (!visit) return { error: "Not found" };

  const places = await prisma.place.findMany({ select: { id: true, name: true, lat: true, lon: true, radius: true } });
  const nearestKnownPlaces = places
    .map((place) => ({ ...place, distanceM: Math.round(haversineKm(visit.lat, visit.lon, place.lat, place.lon) * 1000) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 5);

  let immichPhotos: { id: string; lat: number | null; lon: number | null; takenAt: string }[] = [];
  if (isImmichConfigured()) {
    try {
      immichPhotos = await getImmichPhotos(visit.arrivalAt, visit.departureAt);
    } catch {
      // Immich is optional; keep the timeline review usable when it is unavailable.
    }
  }

  return {
    id: visit.id,
    status: visit.status,
    lat: visit.lat,
    lon: visit.lon,
    arrivalAt: serializeDate(visit.arrivalAt),
    departureAt: serializeDate(visit.departureAt),
    durationMinutes: durationMinutes(visit.arrivalAt, visit.departureAt),
    pointCount: visit.pointCount,
    nearestKnownPlaces,
    immichPhotos,
    immichConfigured: isImmichConfigured(),
  };
}

export async function confirmUnknownVisit(id: number, status: Exclude<UnknownVisitStatus, "suggested">) {
  const visit = await prisma.unknownVisitSuggestion.findUnique({ where: { id } });
  if (!visit) return { error: "Not found" };

  const updated = await prisma.unknownVisitSuggestion.update({ where: { id }, data: { status } });
  return {
    ...updated,
    arrivalAt: serializeDate(updated.arrivalAt),
    departureAt: serializeDate(updated.departureAt),
    createdAt: serializeDate(updated.createdAt),
  };
}

export async function createPlaceFromUnknownVisit(input: { id: number; name: string; radius?: number }) {
  const { id, name, radius = 50 } = input;
  const suggestion = await prisma.unknownVisitSuggestion.findUnique({ where: { id } });
  if (!suggestion) return { error: "Unknown visit not found" };

  const place = await prisma.place.create({ data: { name, lat: suggestion.lat, lon: suggestion.lon, radius } });

  const placeRadiusKm = place.radius / 1000;
  const unknownSuggestions = await prisma.unknownVisitSuggestion.findMany({ where: { status: "suggested" } });
  const overlapping = unknownSuggestions.filter((item) => haversineKm(item.lat, item.lon, place.lat, place.lon) <= placeRadiusKm);
  if (overlapping.length > 0) {
    await prisma.unknownVisitSuggestion.updateMany({
      where: { id: { in: overlapping.map((item) => item.id) } },
      data: { status: "confirmed" },
    });
  }
  await prisma.unknownVisitSuggestion.update({ where: { id }, data: { status: "confirmed" } });

  const { newVisits } = await triggerVisitDetection();

  return {
    place: { ...place, createdAt: serializeDate(place.createdAt) },
    newVisits,
    dismissedSuggestions: overlapping.length,
  };
}

export async function getCurrentLocation() {
  const point = await prisma.locationPoint.findFirst({
    orderBy: { recordedAt: "desc" },
    select: { id: true, lat: true, lon: true, tst: true, recordedAt: true, acc: true, alt: true, vel: true, batt: true },
  });
  if (!point) return { location: null, message: "No location data found" };
  return { ...point, recordedAt: serializeDate(point.recordedAt) };
}

export async function getLocationHistory(input: DateRangeInput & LimitInput & { date?: string } = {}) {
  const { date, start, end, limit = 1000 } = input;
  let startDate: Date;
  let endDate: Date;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date format. Use YYYY-MM-DD" };
    startDate = new Date(`${date}T00:00:00`);
    endDate = new Date(`${date}T23:59:59.999`);
  } else if (start && end) {
    startDate = new Date(start);
    endDate = new Date(end);
  } else {
    const today = new Date();
    startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  }

  const points = await prisma.locationPoint.findMany({
    where: { recordedAt: { gte: startDate, lte: endDate } },
    orderBy: { recordedAt: "asc" },
    take: limit,
    select: { id: true, lat: true, lon: true, tst: true, recordedAt: true, acc: true, alt: true, vel: true, batt: true },
  });

  return {
    count: points.length,
    points: points.map((point) => ({ ...point, recordedAt: serializeDate(point.recordedAt) })),
  };
}

export async function getVisits(input: DateRangeInput & LimitInput & { date?: string; status?: VisitStatus } = {}) {
  const { start, end, status = "all", date, limit = 100 } = input;
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date format. Use YYYY-MM-DD" };
    startDate = new Date(`${date}T00:00:00`);
    endDate = new Date(`${date}T23:59:59.999`);
  } else {
    if (start) startDate = new Date(start);
    if (end) endDate = new Date(end);
  }

  const statusFilter = status === "all" ? undefined : status;
  const visits = await prisma.visit.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(startDate || endDate ? {
        AND: [
          ...(endDate ? [{ arrivalAt: { lt: endDate } }] : []),
          ...(startDate ? [{ departureAt: { gt: startDate } }] : []),
        ],
      } : {}),
    },
    include: { place: { select: { id: true, name: true, lat: true, lon: true, radius: true } } },
    orderBy: { arrivalAt: "asc" },
    take: limit,
  });

  return visits.map((visit) => ({
    ...visit,
    arrivalAt: serializeDate(visit.arrivalAt),
    departureAt: serializeDate(visit.departureAt),
    createdAt: serializeDate(visit.createdAt),
    durationMinutes: durationMinutes(visit.arrivalAt, visit.departureAt),
  }));
}

export async function getPlaces(input: { activeOnly?: boolean } = {}) {
  const { activeOnly = true } = input;
  const places = await prisma.place.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: { _count: { select: { visits: true } } },
    orderBy: { createdAt: "desc" },
  });

  return places.map((place) => ({
    id: place.id,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    radius: place.radius,
    isActive: place.isActive,
    createdAt: serializeDate(place.createdAt),
    totalVisits: place._count.visits,
  }));
}
