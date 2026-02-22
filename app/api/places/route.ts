import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectVisitsForPlace } from "@/lib/detectVisits";
import { haversineKm } from "@/lib/geo";

export async function GET() {
  const places = await prisma.place.findMany({
    include: {
      _count: { select: { visits: true } },
      visits: {
        where: { status: "confirmed" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    radius: p.radius,
    createdAt: p.createdAt,
    totalVisits: p._count.visits,
    confirmedVisits: p.visits.length,
  }));

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
    (s) => haversineKm(s.lat, s.lon, place.lat, place.lon) <= placeRadiusKm
  );
  if (overlapping.length > 0) {
    await prisma.unknownVisitSuggestion.updateMany({
      where: { id: { in: overlapping.map((s) => s.id) } },
      data: { status: "confirmed" },
    });
  }

  const newVisits = await detectVisitsForPlace(place.id);

  return NextResponse.json({ place, newVisits }, { status: 201 });
}
