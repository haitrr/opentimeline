import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileVisitSuggestionsForPlace } from "@/lib/detectVisits";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const placeId = parseInt(id, 10);

  if (isNaN(placeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const name = body.name != null ? String(body.name).trim() : place.name;
  const radius = body.radius != null ? Number(body.radius) : place.radius;
  const lat = body.lat != null ? Number(body.lat) : place.lat;
  const lon = body.lon != null ? Number(body.lon) : place.lon;
  const isActive = body.isActive != null ? Boolean(body.isActive) : place.isActive;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    return NextResponse.json(
      { error: "radius must be a positive number" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json(
      { error: "lat must be between -90 and 90" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "lon must be between -180 and 180" },
      { status: 400 }
    );
  }

  const updated = await prisma.place.update({
    where: { id: placeId },
    data: { name, radius, lat, lon, isActive },
  });

  const reconciliation = await reconcileVisitSuggestionsForPlace(placeId);

  return NextResponse.json({ place: updated, suggestions: reconciliation });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const placeId = parseInt(id, 10);

  if (isNaN(placeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.place.delete({ where: { id: placeId } });
  return NextResponse.json({ deleted: true });
}
