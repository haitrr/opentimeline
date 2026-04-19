import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const filters = await prisma.deviceFilter.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    filters.map((f) => ({
      id: f.id,
      fromTime: f.fromTime.toISOString(),
      toTime: f.toTime.toISOString(),
      deviceIds: f.deviceIds,
      label: f.label,
      createdAt: f.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { fromTime, toTime, deviceIds, label } = body;

  if (!fromTime || !toTime || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return NextResponse.json(
      { error: "fromTime, toTime, and deviceIds are required" },
      { status: 400 }
    );
  }

  const from = new Date(fromTime);
  const to = new Date(toTime);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const filter = await prisma.deviceFilter.create({
    data: { fromTime: from, toTime: to, deviceIds, label: label ?? null },
  });

  return NextResponse.json(
    {
      id: filter.id,
      fromTime: filter.fromTime.toISOString(),
      toTime: filter.toTime.toISOString(),
      deviceIds: filter.deviceIds,
      label: filter.label,
      createdAt: filter.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
