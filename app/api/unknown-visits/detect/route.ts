import { NextResponse } from "next/server";
import { detectUnknownVisits } from "@/lib/detectUnknownVisits";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;

  try {
    const body = await request.json();
    if (body.start) rangeStart = new Date(body.start);
    if (body.end) rangeEnd = new Date(body.end);
  } catch {
    // no body or invalid JSON — run without range filter
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const sessionGapMinutes = settings?.unknownSessionGapMinutes ?? 15;
  const minDwellMinutes = settings?.unknownMinDwellMinutes ?? 15;
  const clusterRadiusM = settings?.unknownClusterRadiusM ?? 50;

  const created = await detectUnknownVisits(rangeStart, rangeEnd, sessionGapMinutes, minDwellMinutes, clusterRadiusM);
  return NextResponse.json({ created });
}
