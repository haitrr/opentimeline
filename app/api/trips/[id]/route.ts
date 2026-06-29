import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = body.name != null ? String(body.name).trim() : trip.name;
  const start = body.startDate ? new Date(body.startDate) : trip.startDate;
  const end = body.endDate ? new Date(body.endDate) : trip.endDate;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (start >= end) return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 });

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: { name, startDate: start, endDate: end },
  });

  return NextResponse.json({
    trip: {
      ...updated,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tripId = parseInt(id, 10);
  if (isNaN(tripId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trip.delete({ where: { id: tripId } });
  return NextResponse.json({ deleted: true });
}
