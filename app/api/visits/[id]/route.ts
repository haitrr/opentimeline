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

  const body = await request.json();
  const { status } = body;

  if (!["confirmed", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'confirmed' or 'rejected'" },
      { status: 400 }
    );
  }

  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: { status },
  });

  return NextResponse.json(updated);
}
