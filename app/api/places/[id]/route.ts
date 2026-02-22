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

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    return NextResponse.json(
      { error: "radius must be a positive number" },
      { status: 400 }
    );
  }

  const updated = await prisma.place.update({
    where: { id: placeId },
    data: { name, radius },
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
