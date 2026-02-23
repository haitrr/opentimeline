import { NextResponse } from "next/server";
import { detectVisitsForAllPlaces } from "@/lib/detectVisits";

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

  const newVisits = await detectVisitsForAllPlaces(15, rangeStart, rangeEnd);
  return NextResponse.json({ newVisits });
}
