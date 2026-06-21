import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const locationId = parseInt(id, 10);

  if (isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const location = await prisma.locationPoint.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const lat = Number(body.lat);
  const lon = Number(body.lon);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "lat must be between -90 and 90" }, { status: 400 });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "lon must be between -180 and 180" }, { status: 400 });
  }

  const updated = await prisma.locationPoint.update({
    where: { id: locationId },
    data: { lat, lon },
  });

  return NextResponse.json(updated);
}
