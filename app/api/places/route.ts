import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectVisitsForPlace } from "@/lib/detectVisits";
import { haversineKm } from "@/lib/geo";

export async function GET(request: NextRequest) {
  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");
  const minLat = request.nextUrl.searchParams.get("minLat");
  const maxLat = request.nextUrl.searchParams.get("maxLat");
  const minLon = request.nextUrl.searchParams.get("minLon");
  const maxLon = request.nextUrl.searchParams.get("maxLon");

  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;

  const hasValidRange =
    start != null &&
    end != null &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime());

  const hasBounds =
    minLat != null && maxLat != null && minLon != null && maxLon != null;

  const boundsWhere = hasBounds
    ? {
        lat: { gte: parseFloat(minLat!), lte: parseFloat(maxLat!) },
        lon: { gte: parseFloat(minLon!), lte: parseFloat(maxLon!) },
      }
    : {};

  const visitsWhere = hasValidRange
    ? {
        status: { in: ["confirmed", "suggested"] },
        arrivalAt: { lte: end! },
        departureAt: { gte: start! },
      }
    : { status: { in: ["confirmed", "suggested"] } };

  const places = await prisma.place.findMany({
    where: boundsWhere,
    include: {
      _count: { select: { visits: true } },
      visits: {
        where: visitsWhere,
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get last confirmed visit date per place in a single query
  const placeIds = places.map((p: (typeof places)[number]) => p.id);
  const lastVisits =
    placeIds.length > 0
      ? await prisma.visit.groupBy({
          by: ["placeId"],
          where: {
            placeId: { in: placeIds },
            status: "confirmed",
          },
          _max: { departureAt: true },
        })
      : [];

  const lastVisitMap = new Map(
    lastVisits.map((lv: (typeof lastVisits)[number]) => [
      lv.placeId,
      lv._max.departureAt,
    ])
  );

  const result = places.map((p: (typeof places)[number]) => {
    const confirmedVisitsInRange = p.visits.filter(
      (visit: (typeof p.visits)[number]) => visit.status === "confirmed"
    ).length;
    const suggestedVisitsInRange = p.visits.filter(
      (visit: (typeof p.visits)[number]) => visit.status === "suggested"
    ).length;

    const lastVisitDate = lastVisitMap.get(p.id);

    return {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      radius: p.radius,
      isActive: p.isActive,
      createdAt: p.createdAt,
      totalVisits: p._count.visits,
      confirmedVisits: confirmedVisitsInRange,
      visitsInRange: confirmedVisitsInRange + suggestedVisitsInRange,
      confirmedVisitsInRange,
      suggestedVisitsInRange,
      lastVisitAt: lastVisitDate ? lastVisitDate.toISOString() : null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, lat, lon, radius } = body;

  if (!name || lat == null || lon == null) {
    return NextResponse.json(
      { error: "name, lat, and lon are required" },
      { status: 400 }
    );
  }

  const place = await prisma.place.create({
    data: {
      name: String(name),
      lat: Number(lat),
      lon: Number(lon),
      radius: radius != null ? Number(radius) : 50,
    },
  });

  // Dismiss any unknown visit suggestions whose cluster center falls within
  // the new place's radius, before running visit detection to avoid duplicates.
  const placeRadiusKm = place.radius / 1000;
  const unknownSuggestions = await prisma.unknownVisitSuggestion.findMany({
    where: { status: "suggested" },
  });
  const overlapping = unknownSuggestions.filter(
    (s: (typeof unknownSuggestions)[number]) =>
      haversineKm(s.lat, s.lon, place.lat, place.lon) <= placeRadiusKm
  );
  if (overlapping.length > 0) {
    await prisma.unknownVisitSuggestion.updateMany({
      where: {
        id: { in: overlapping.map((s: (typeof overlapping)[number]) => s.id) },
      },
      data: { status: "confirmed" },
    });
  }

  const newVisits = await detectVisitsForPlace(place.id);

  return NextResponse.json({ place, newVisits }, { status: 201 });
}
