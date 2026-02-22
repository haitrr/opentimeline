import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const placeId = searchParams.get("placeId");

  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const visits = await prisma.visit.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(placeId ? { placeId: parseInt(placeId, 10) } : {}),
      ...(start || end
        ? {
            AND: [
              ...(end ? [{ arrivalAt: { lt: new Date(end) } }] : []),
              ...(start ? [{ departureAt: { gt: new Date(start) } }] : []),
            ],
          }
        : {}),
    },
    include: {
      place: {
        select: { id: true, name: true, lat: true, lon: true, radius: true },
      },
    },
    orderBy: { arrivalAt: "asc" },
  });

  return NextResponse.json(visits);
}
