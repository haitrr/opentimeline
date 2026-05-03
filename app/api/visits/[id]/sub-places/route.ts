import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.subPlaceIds)) {
    return NextResponse.json({ error: "subPlaceIds must be an array" }, { status: 400 });
  }

  const subPlaceIds: number[] = body.subPlaceIds.map(Number).filter(Number.isInteger);

  const parentVisit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!parentVisit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existingChildVisits = await prisma.visit.findMany({
    where: { parentVisitId: visitId },
    select: { id: true, placeId: true },
  });

  const existingPlaceIds = new Set(existingChildVisits.map((v) => v.placeId));
  const requestedIds = new Set(subPlaceIds);

  const toCreate = subPlaceIds.filter((pid) => !existingPlaceIds.has(pid));
  const toDelete = existingChildVisits
    .filter((v) => !requestedIds.has(v.placeId))
    .map((v) => v.id);

  if (toCreate.length > 0) {
    await prisma.visit.createMany({
      data: toCreate.map((placeId) => ({
        placeId,
        parentVisitId: visitId,
        arrivalAt: parentVisit.arrivalAt,
        departureAt: parentVisit.departureAt,
        status: "confirmed",
        pointCount: 0,
      })),
    });
  }

  if (toDelete.length > 0) {
    await prisma.visit.deleteMany({ where: { id: { in: toDelete } } });
  }

  const updated = await prisma.visit.findMany({
    where: { parentVisitId: visitId },
    select: { id: true, placeId: true },
  });

  return NextResponse.json({ checkedSubPlaceIds: updated.map((v) => v.placeId) });
}
