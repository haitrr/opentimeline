import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { placeId, arrivalAt, departureAt, status = "confirmed" } = body as {
    placeId?: number;
    arrivalAt?: string;
    departureAt?: string;
    status?: string;
  };

  if (!placeId || !arrivalAt || !departureAt) {
    return NextResponse.json({ error: "placeId, arrivalAt, departureAt are required" }, { status: 400 });
  }

  const arrival = new Date(arrivalAt);
  const departure = new Date(departureAt);
  if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  if (arrival >= departure) {
    return NextResponse.json({ error: "arrivalAt must be before departureAt" }, { status: 400 });
  }

  const visit = await prisma.visit.create({
    data: { placeId, arrivalAt: arrival, departureAt: departure, status },
    include: { place: { select: { id: true, name: true, lat: true, lon: true, radius: true } } },
  });

  return NextResponse.json(visit, { status: 201 });
}

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
