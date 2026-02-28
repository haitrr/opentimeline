import { NextResponse } from "next/server";
import { detectVisitsForAllPlaces } from "@/lib/detectVisits";
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
  const sessionGapMinutes = settings?.sessionGapMinutes ?? 15;
  const minDwellMinutes = settings?.minDwellMinutes ?? 15;
  const postDepartureMinutes = settings?.postDepartureMinutes ?? 15;

  const newVisits = await detectVisitsForAllPlaces(sessionGapMinutes, minDwellMinutes, postDepartureMinutes, rangeStart, rangeEnd);
  return NextResponse.json({ newVisits });
}
