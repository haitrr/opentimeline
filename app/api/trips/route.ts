import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const trips = await prisma.trip.findMany({ orderBy: { startDate: "desc" } });

  const tripsWithCounts = await Promise.all(
    trips.map(async (trip) => {
      const visitCount = await prisma.visit.count({
        where: {
          status: "confirmed",
          arrivalAt: { lte: trip.endDate },
          departureAt: { gte: trip.startDate },
        },
      });
      return {
        ...trip,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        createdAt: trip.createdAt.toISOString(),
        visitCount,
      };
    })
  );

  return NextResponse.json({ trips: tripsWithCounts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, startDate, endDate } = body as { name?: string; startDate?: string; endDate?: string };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (!start || isNaN(start.getTime()))
    return NextResponse.json({ error: "startDate is required" }, { status: 400 });
  if (!end || isNaN(end.getTime()))
    return NextResponse.json({ error: "endDate is required" }, { status: 400 });
  if (start >= end)
    return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 });

  const trip = await prisma.trip.create({
    data: { name: name.trim(), startDate: start, endDate: end },
  });

  return NextResponse.json(
    {
      trip: {
        ...trip,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        createdAt: trip.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
