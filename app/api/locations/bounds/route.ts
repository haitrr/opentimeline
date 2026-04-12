import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    WHERE "recordedAt" BETWEEN ${start} AND ${end};
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
