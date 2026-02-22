import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GpxPoint } from "@/lib/parseGpx";

export async function POST(request: NextRequest) {
  let points: GpxPoint[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.points)) {
      return NextResponse.json({ error: "Expected { points: GpxPoint[] }" }, { status: 400 });
    }
    points = body.points;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (points.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  // Find existing tst values in the range of incoming points to skip duplicates
  const tsts = points.map((p) => p.tst);
  const minTst = Math.min(...tsts);
  const maxTst = Math.max(...tsts);

  const existing = await prisma.locationPoint.findMany({
    where: { tst: { gte: minTst, lte: maxTst } },
    select: { tst: true },
  });
  const existingTsts = new Set(existing.map((p) => p.tst));

  const newPoints = points.filter((p) => !existingTsts.has(p.tst));

  if (newPoints.length === 0) {
    return NextResponse.json({ imported: 0 });
  }

  await prisma.locationPoint.createMany({
    data: newPoints.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      tst: p.tst,
      recordedAt: new Date(p.recordedAt),
      alt: p.alt ?? null,
      vel: p.vel ?? null,
      cog: p.cog ?? null,
      acc: null,
      batt: null,
      tid: null,
      trigger: "gpx-import",
      username: null,
      deviceId: null,
    })),
  });

  return NextResponse.json({ imported: newPoints.length });
}
