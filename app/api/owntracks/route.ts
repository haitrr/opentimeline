import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OwnTracksPayload } from "@/types/owntracks";

export async function POST(request: NextRequest) {
  let body: OwnTracksPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // OwnTracks sends various event types — only process location events
  if (body._type !== "location") {
    return NextResponse.json({ result: [] });
  }

  if (typeof body.lat !== "number" || typeof body.lon !== "number" || typeof body.tst !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Extract device identity from OwnTracks HTTP topic query params
  // OwnTracks HTTP mode: POST /api/owntracks?u=username&d=deviceid
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("u") ?? body.tid ?? null;
  const deviceId = searchParams.get("d") ?? null;

  // Idempotency: skip if this exact point was already stored
  const existing = await prisma.locationPoint.findFirst({
    where: { tst: body.tst, tid: body.tid ?? null },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ result: [] });
  }

  await prisma.locationPoint.create({
    data: {
      lat: body.lat,
      lon: body.lon,
      tst: body.tst,
      recordedAt: new Date(body.tst * 1000),
      acc: body.acc ?? null,
      batt: body.batt ?? null,
      tid: body.tid ?? null,
      alt: body.alt ?? null,
      vel: body.vel ?? null,
      cog: body.cog ?? null,
      trigger: body.t ?? null,
      username,
      deviceId,
    },
  });

  // OwnTracks HTTP mode expects this exact response shape
  return NextResponse.json({ result: [] });
}
