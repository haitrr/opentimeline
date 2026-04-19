import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DeviceFilter = { fromTime: Date; toTime: Date; deviceIds: string[] };

function buildDeviceFilterSql(filters: DeviceFilter[]): Prisma.Sql {
  if (filters.length === 0) return Prisma.sql`TRUE`;
  const clauses = filters.map((f) => {
    const ids = Prisma.join(f.deviceIds.map((id) => Prisma.sql`${id}`));
    return Prisma.sql`(
      "recordedAt" NOT BETWEEN ${f.fromTime} AND ${f.toTime}
      OR "deviceId" IS NULL
      OR "deviceId" IN (${ids})
    )`;
  });
  return clauses.reduce((acc, c) => Prisma.sql`${acc} AND ${c}`);
}

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

  const rows = await prisma.$queryRaw<
    {
      minLat: number | null;
      maxLat: number | null;
      minLon: number | null;
      maxLon: number | null;
    }[]
  >`
    SELECT
      MIN(lat)::double precision AS "minLat",
      MAX(lat)::double precision AS "maxLat",
      MIN(lon)::double precision AS "minLon",
      MAX(lon)::double precision AS "maxLon"
    FROM "LocationPoint"
    WHERE "recordedAt" BETWEEN ${start} AND ${end}
      AND ${deviceFilterSql};
  `;

  const row = rows[0];
  if (!row || row.minLat === null || row.maxLat === null || row.minLon === null || row.maxLon === null) {
    return NextResponse.json({ error: "No points in range" }, { status: 404 });
  }

  return NextResponse.json({
    minLat: row.minLat,
    maxLat: row.maxLat,
    minLon: row.minLon,
    maxLon: row.maxLon,
  });
}
