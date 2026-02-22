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

  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();

  const status = body.status != null ? String(body.status) : visit.status;
  if (!["suggested", "confirmed", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'suggested', 'confirmed', or 'rejected'" },
      { status: 400 }
    );
  }

  const arrivalAt = body.arrivalAt != null ? new Date(String(body.arrivalAt)) : visit.arrivalAt;
  const departureAt =
    body.departureAt != null ? new Date(String(body.departureAt)) : visit.departureAt;

  if (Number.isNaN(arrivalAt.getTime()) || Number.isNaN(departureAt.getTime())) {
    return NextResponse.json(
      { error: "arrivalAt and departureAt must be valid ISO datetimes" },
      { status: 400 }
    );
  }

  if (departureAt.getTime() <= arrivalAt.getTime()) {
    return NextResponse.json(
      { error: "departureAt must be after arrivalAt" },
      { status: 400 }
    );
  }

  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: { status, arrivalAt, departureAt },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.visit.delete({ where: { id: visitId } });
  return NextResponse.json({ deleted: true });
}
