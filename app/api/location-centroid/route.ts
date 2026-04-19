import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDeviceFilterSql } from "@/lib/device-filters";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");
  if (!startRaw || !endRaw) {
    return NextResponse.json({ error: "Missing start or end" }, { status: 400 });
  }
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const deviceFilters = await prisma.deviceFilter.findMany();
  const deviceFilterSql = buildDeviceFilterSql(deviceFilters);

  const rows = await prisma.$queryRaw<{ lat: number | null; lon: number | null }[]>`
    SELECT AVG(lat)::double precision AS lat, AVG(lon)::double precision AS lon
    FROM "LocationPoint"
    WHERE "recordedAt" BETWEEN ${start} AND ${end}
      AND ${deviceFilterSql};
  `;

  const row = rows[0];
  if (!row || row.lat === null || row.lon === null) {
    return NextResponse.json({ error: "No points in window" }, { status: 404 });
  }

  return NextResponse.json({ lat: row.lat, lon: row.lon });
}
