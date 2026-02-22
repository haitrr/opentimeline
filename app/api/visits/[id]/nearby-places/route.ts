import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

const NEARBY_RADIUS_M = 100;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visitId = parseInt(id, 10);

  if (Number.isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      place: {
        select: { id: true, lat: true, lon: true },
      },
    },
  });

  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const points = await prisma.locationPoint.findMany({
    where: {
      recordedAt: {
        gte: visit.arrivalAt,
        lte: visit.departureAt,
      },
    },
    select: { lat: true, lon: true },
  });

  const visitCenter =
    points.length > 0
      ? {
          lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
          lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
        }
      : {
          lat: visit.place.lat,
          lon: visit.place.lon,
        };

  const places = await prisma.place.findMany({
    select: { id: true, name: true, lat: true, lon: true },
  });

  const nearbyPlaces = places
    .map((place) => ({
      id: place.id,
      name: place.name,
      distanceM: Math.round(
        haversineKm(visitCenter.lat, visitCenter.lon, place.lat, place.lon) * 1000
      ),
    }))
    .filter((place) => place.distanceM <= NEARBY_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  return NextResponse.json({
    visitCenter,
    places: nearbyPlaces,
  });
}