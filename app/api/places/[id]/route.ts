import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
