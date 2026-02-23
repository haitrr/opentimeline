import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const visit = await prisma.unknownVisitSuggestion.findUnique({ where: { id: visitId } });
  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  const status = body.status != null ? String(body.status) : visit.status;
  if (!["suggested", "confirmed", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const arrivalAt = body.arrivalAt != null ? new Date(String(body.arrivalAt)) : visit.arrivalAt;
  const departureAt = body.departureAt != null ? new Date(String(body.departureAt)) : visit.departureAt;

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

  const updated = await prisma.unknownVisitSuggestion.update({
    where: { id: visitId },
    data: { status, arrivalAt, departureAt },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const visit = await prisma.unknownVisitSuggestion.findUnique({ where: { id: visitId } });
  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.unknownVisitSuggestion.delete({ where: { id: visitId } });
  return NextResponse.json({ deleted: true });
}
