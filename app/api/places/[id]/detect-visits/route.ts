import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectVisitsForPlace } from "@/lib/detectVisits";

export async function POST(
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

  const newVisits = await detectVisitsForPlace(placeId);
  return NextResponse.json({ newVisits });
}
